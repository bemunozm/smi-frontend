import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, cleanup, screen, fireEvent, within } from '@testing-library/react';

import type { Hallazgo } from '../types/hallazgos';

const { listHook, actualizarMock, eliminarMock, crearMock, actualizarPending, eliminarPending } = vi.hoisted(() => ({
  listHook: vi.fn(),
  actualizarMock: vi.fn(),
  eliminarMock: vi.fn(),
  crearMock: vi.fn(),
  actualizarPending: { value: false },
  eliminarPending: { value: false },
}));

vi.mock('../hooks/useHallazgos', () => ({
  useHallazgosList: () => listHook(),
  useActualizarHallazgo: () => ({ mutate: actualizarMock, isPending: actualizarPending.value }),
  useEliminarHallazgo: () => ({ mutate: eliminarMock, isPending: eliminarPending.value }),
  useCrearHallazgo: () => ({ mutate: crearMock, isPending: false }),
}));

vi.mock('../hooks/useEquipment', () => ({
  useEquipment: () => ({ data: [{ id: 'e1', internalCode: 'PE-004' }, { id: 'e2', internalCode: 'EX-001' }] }),
}));

import { HallazgosAdminView } from './HallazgosAdminView';

const hallazgo = (over: Partial<Hallazgo> & Pick<Hallazgo, 'id'>): Hallazgo => ({
  equipoId: 'e1',
  descripcion: 'Fuga de aceite hidráulico',
  prioridad: 'ALTA',
  estado: 'ABIERTO',
  fotoUrl: null,
  fecha: '2026-10-14T15:02:00.000Z',
  equipo: { internalCode: 'PE-004' },
  ...over,
});

const LISTA: Hallazgo[] = [
  hallazgo({ id: 'h1', fotoUrl: 'https://signed/h1.jpg', registradoPor: 'Ana Soto' }),
  hallazgo({
    id: 'h2',
    equipoId: 'e2',
    equipo: { internalCode: 'EX-001' },
    descripcion: 'Ruido anormal en motor',
    prioridad: 'MEDIA',
    estado: 'EN_PROCESO',
    registradoPor: 'Pedro Pérez',
  }),
  // Sin `registradoPor`: registro legacy o cuenta borrada — la fila muestra raya.
  hallazgo({ id: 'h3', descripcion: 'Frenos reparados', estado: 'CERRADO', registradoPor: null }),
];

const ok = (data: Hallazgo[]) => ({ data, isPending: false, isError: false, error: null });

beforeEach(() => {
  listHook.mockReturnValue(ok(LISTA));
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('HallazgosAdminView', () => {
  it('lista todos los hallazgos con equipo, chips y conteos por estado', () => {
    render(<HallazgosAdminView />);
    expect(screen.getByTestId('hallazgo-fila-h1')).toBeTruthy();
    expect(screen.getByText('Fuga de aceite hidráulico')).toBeTruthy();
    expect(screen.getByText('Ruido anormal en motor')).toBeTruthy();
    expect(screen.getByTestId('total-ABIERTO').textContent).toBe('1 abierto');
    expect(screen.getByTestId('total-EN_PROCESO').textContent).toBe('1 en proceso');
    expect(screen.getByTestId('total-CERRADO').textContent).toBe('1 cerrado');
  });

  it('filtra por estado y por texto (descripción o equipo)', () => {
    render(<HallazgosAdminView />);
    fireEvent.change(screen.getByLabelText(/estado/i), { target: { value: 'CERRADO' } });
    expect(screen.queryByTestId('hallazgo-fila-h1')).toBeNull();
    expect(screen.getByTestId('hallazgo-fila-h3')).toBeTruthy();

    fireEvent.change(screen.getByLabelText(/estado/i), { target: { value: 'TODOS' } });
    fireEvent.change(screen.getByPlaceholderText(/Buscar/), { target: { value: 'ex-001' } });
    expect(screen.queryByTestId('hallazgo-fila-h1')).toBeNull();
    expect(screen.getByTestId('hallazgo-fila-h2')).toBeTruthy();
  });

  it('clic en una fila abre el detalle con la foto y las acciones del admin', () => {
    render(<HallazgosAdminView />);
    fireEvent.click(screen.getByTestId('hallazgo-fila-h1'));
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText('Hallazgo · PE-004')).toBeTruthy();
    expect(within(dialog).getByText('Fuga de aceite hidráulico')).toBeTruthy();
    expect(within(dialog).getByRole('img', { name: 'Foto del hallazgo de PE-004' }).getAttribute('src')).toBe(
      'https://signed/h1.jpg',
    );
    expect(within(dialog).getByRole('button', { name: 'Editar' })).toBeTruthy();
    expect(within(dialog).getByRole('button', { name: 'Eliminar' })).toBeTruthy();
  });

  it('eliminar pide confirmación y recién ahí llama al DELETE', () => {
    render(<HallazgosAdminView />);
    fireEvent.click(screen.getByTestId('hallazgo-fila-h2'));
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Eliminar' }));

    const confirmacion = screen.getByRole('alertdialog');
    expect(within(confirmacion).getByText(/se eliminará definitivamente/)).toBeTruthy();
    expect(eliminarMock).not.toHaveBeenCalled();

    fireEvent.click(within(confirmacion).getByRole('button', { name: 'Eliminar' }));
    expect(eliminarMock).toHaveBeenCalledWith('h2', expect.anything());
  });

  it('editar guarda SOLO los campos cambiados', () => {
    render(<HallazgosAdminView />);
    fireEvent.click(screen.getByTestId('hallazgo-fila-h1'));
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Editar' }));

    const editor = screen.getByRole('dialog');
    expect(within(editor).getByText('Editar hallazgo · PE-004')).toBeTruthy();

    const guardar = within(editor).getByRole('button', { name: 'Guardar cambios' });
    // Sin cambios, no hay nada que guardar.
    expect(guardar.hasAttribute('disabled') || guardar.getAttribute('aria-disabled') === 'true').toBe(true);

    fireEvent.change(within(editor).getByLabelText('Descripción'), {
      target: { value: 'Fuga de aceite hidráulico en cilindro' },
    });
    fireEvent.click(within(editor).getByRole('button', { name: 'Guardar cambios' }));
    expect(actualizarMock).toHaveBeenCalledWith(
      { id: 'h1', cambios: { descripcion: 'Fuga de aceite hidráulico en cilindro' } },
      expect.anything(),
    );
  });

  it('muestra el error del listado', () => {
    listHook.mockReturnValue({ data: undefined, isPending: false, isError: true, error: new Error('Falló Terreno') });
    render(<HallazgosAdminView />);
    expect(screen.getByText('Falló Terreno')).toBeTruthy();
  });

  it('la tabla y el detalle muestran quién registró cada hallazgo', () => {
    render(<HallazgosAdminView />);

    expect(within(screen.getByTestId('hallazgo-fila-h1')).getByText('Ana Soto')).toBeTruthy();
    expect(within(screen.getByTestId('hallazgo-fila-h2')).getByText('Pedro Pérez')).toBeTruthy();

    fireEvent.click(screen.getByTestId('hallazgo-fila-h1'));
    expect(within(screen.getByRole('dialog')).getByText(/Ana Soto/)).toBeTruthy();
  });

  it('el detalle presenta fecha, hora, equipo y quién lo registró como filas de dato, con la descripción y la foto', () => {
    render(<HallazgosAdminView />);
    fireEvent.click(screen.getByTestId('hallazgo-fila-h1'));

    const dialog = screen.getByRole('dialog');
    for (const label of ['Fecha', 'Hora', 'Equipo', 'Registrado por', 'Descripción', 'Foto']) {
      expect(within(dialog).getByText(label)).toBeTruthy();
    }
    expect(within(dialog).getByText('Ana Soto')).toBeTruthy();
    expect(within(dialog).getByText('Fuga de aceite hidráulico')).toBeTruthy();
    expect(within(dialog).getByRole('img', { name: 'Foto del hallazgo de PE-004' })).toBeTruthy();
  });

  it('el detalle sin nombre de quien registró muestra raya, y sin foto lo dice', () => {
    render(<HallazgosAdminView />);
    fireEvent.click(screen.getByTestId('hallazgo-fila-h3'));

    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText('—')).toBeTruthy();
    expect(within(dialog).getByText('Sin foto adjunta.')).toBeTruthy();
  });

  it('«Nuevo hallazgo» registra con equipo, prioridad y descripción', async () => {
    render(<HallazgosAdminView />);
    fireEvent.click(screen.getByRole('button', { name: 'Nuevo hallazgo' }));

    const dialog = screen.getByRole('dialog');
    const registrar = within(dialog).getByRole('button', { name: 'Registrar hallazgo' });
    // Sin equipo ni descripción todavía no hay nada que registrar.
    expect(registrar.hasAttribute('disabled') || registrar.getAttribute('aria-disabled') === 'true').toBe(true);

    fireEvent.click(within(dialog).getByRole('button', { name: /Equipo/ }));
    fireEvent.click(await screen.findByRole('option', { name: 'EX-001' }));
    fireEvent.change(within(dialog).getByLabelText('Descripción'), {
      target: { value: 'Neumático delantero cortado' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Registrar hallazgo' }));

    expect(crearMock).toHaveBeenCalledWith(
      { equipoId: 'e2', descripcion: 'Neumático delantero cortado', prioridad: 'MEDIA' },
      expect.anything(),
    );
  });
});
