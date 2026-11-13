import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';

import { toDateTimeLocal } from '../../lib/format';
import { NuevaCargaCombustibleModal } from './NuevaCargaCombustibleModal';

const mutateMock = vi.fn();
vi.mock('../../hooks/useCombustible', () => ({
  useCrearCargaCombustible: () => ({ mutate: mutateMock, isPending: false }),
}));

vi.mock('../../hooks/useEquipment', () => ({
  useEquipment: () => ({ data: [{ id: 'eq_1', internalCode: 'EX-001', type: 'Excavadora', equipmentClass: 'HEAVY' }] }),
}));

const readCaptureDateMock = vi.fn();
vi.mock('../../lib/photo-reading', async () => {
  const actual = await vi.importActual<typeof import('../../lib/photo-reading')>('../../lib/photo-reading');
  return { ...actual, readCaptureDate: (...args: unknown[]) => readCaptureDateMock(...args) };
});

const fuelReadingOcrMock = vi.fn();
vi.mock('../../api/OcrAPI', () => ({ fuelReadingOcr: (...args: unknown[]) => fuelReadingOcrMock(...args) }));

afterEach(cleanup);

const FILE = new File(['x'], 'papel.jpg', { type: 'image/jpeg' });

function subirFoto() {
  const input = document.querySelector('input[type="file"]') as HTMLInputElement;
  fireEvent.change(input, { target: { files: [FILE] } });
}

function fechaInput() {
  return document.querySelector('input[type="datetime-local"]') as HTMLInputElement;
}

// Los guards de "no pisar lo tipeado" son el motivo del fix de fotos en
// registros anteriores: el administrador registra cargas que le llegan 24-48 h
// después, tipea fecha/litros del papel y recién ahí adjunta la foto.
describe('NuevaCargaCombustibleModal', () => {
  beforeEach(() => {
    mutateMock.mockReset();
    readCaptureDateMock.mockReset();
    fuelReadingOcrMock.mockReset();
    readCaptureDateMock.mockResolvedValue(null);
    fuelReadingOcrMock.mockResolvedValue({ value: null, status: 'UNREADABLE', confidence: 0 });
  });

  it('el OCR no pisa litros tipeados a mano, y el chip muestra la discrepancia en vez de avalarlos', async () => {
    fuelReadingOcrMock.mockResolvedValue({ value: '120', status: 'CONFIRMED', confidence: 0.95 });

    render(<NuevaCargaCombustibleModal onClose={() => {}} />);
    fireEvent.change(screen.getByLabelText('Litros'), { target: { value: '85' } });
    subirFoto();

    await waitFor(() => expect(screen.getByText(/La foto dice 120 L/)).toBeTruthy());
    expect((screen.getByLabelText('Litros') as HTMLInputElement).value).toBe('85');
    expect(screen.queryByText('Leído de la foto')).toBeNull();
  });

  it('una fecha tipeada a mano no se pisa con el EXIF de la foto', async () => {
    fuelReadingOcrMock.mockResolvedValue({ value: '80', status: 'CONFIRMED', confidence: 0.9 });
    readCaptureDateMock.mockResolvedValue(new Date(2026, 0, 15, 10, 30));

    render(<NuevaCargaCombustibleModal onClose={() => {}} />);
    fireEvent.change(fechaInput(), { target: { value: '2026-11-03T10:00' } });
    subirFoto();

    await waitFor(() => expect(screen.getByText('Leído de la foto')).toBeTruthy());
    expect(fechaInput().value).toBe('2026-11-03T10:00');
  });

  it('sin tocar la fecha, el EXIF de la foto la pre-rellena', async () => {
    const exif = new Date(2026, 0, 15, 10, 30);
    readCaptureDateMock.mockResolvedValue(exif);

    render(<NuevaCargaCombustibleModal onClose={() => {}} />);
    subirFoto();

    await waitFor(() => expect(fechaInput().value).toBe(toDateTimeLocal(exif)));
  });

  it('reemplazar la foto por una sin EXIF no deja la fecha de la foto descartada', async () => {
    const exif = new Date(2026, 0, 15, 10, 30);
    readCaptureDateMock.mockResolvedValue(exif);

    render(<NuevaCargaCombustibleModal onClose={() => {}} />);
    subirFoto();
    await waitFor(() => expect(fechaInput().value).toBe(toDateTimeLocal(exif)));

    // "Reemplazar foto" reusa el mismo input de archivo: la foto nueva entra
    // sin pasar por "Quitar foto".
    readCaptureDateMock.mockResolvedValue(null);
    subirFoto();

    await waitFor(() => expect(fechaInput().value).not.toBe(toDateTimeLocal(exif)));
    expect(fechaInput().value).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
  });

  it('quitar la foto limpia la fecha EXIF y los litros OCR que venían de ella', async () => {
    fuelReadingOcrMock.mockResolvedValue({ value: '80', status: 'CONFIRMED', confidence: 0.9 });
    const exif = new Date(2026, 0, 15, 10, 30);
    readCaptureDateMock.mockResolvedValue(exif);

    render(<NuevaCargaCombustibleModal onClose={() => {}} />);
    subirFoto();
    await waitFor(() => expect(fechaInput().value).toBe(toDateTimeLocal(exif)));
    await waitFor(() => expect((screen.getByLabelText('Litros') as HTMLInputElement).value).toBe('80'));

    fireEvent.click(screen.getByRole('button', { name: 'Quitar foto' }));

    // Sin la foto, la fecha vuelve al "ahora" editable del formulario y los
    // litros sugeridos se van con su evidencia.
    expect(fechaInput().value).not.toBe(toDateTimeLocal(exif));
    expect(fechaInput().value).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
    expect((screen.getByLabelText('Litros') as HTMLInputElement).value).toBe('0');
  });

  it('lo tipeado a mano sobrevive a quitar la foto', async () => {
    fuelReadingOcrMock.mockResolvedValue({ value: null, status: 'UNREADABLE', confidence: 0 });

    render(<NuevaCargaCombustibleModal onClose={() => {}} />);
    fireEvent.change(screen.getByLabelText('Litros'), { target: { value: '85' } });
    fireEvent.change(fechaInput(), { target: { value: '2026-11-03T10:00' } });
    subirFoto();
    await waitFor(() => expect(screen.getByText(/No se pudo leer la foto/)).toBeTruthy());

    fireEvent.click(screen.getByRole('button', { name: 'Quitar foto' }));

    expect((screen.getByLabelText('Litros') as HTMLInputElement).value).toBe('85');
    expect(fechaInput().value).toBe('2026-11-03T10:00');
  });
});
