import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { RegistrarCargaCombustibleModal } from './RegistrarCargaCombustibleModal';

const mutateMock = vi.fn();
let isPending = false;
vi.mock('../../hooks/useCombustible', () => ({
  useCreateCombustible: () => ({ mutate: mutateMock, isPending }),
}));

const uploadImageMock = vi.fn();
vi.mock('../../api/UploadsAPI', () => ({
  uploadImage: (...args: unknown[]) => uploadImageMock(...args),
}));

const readCaptureDateMock = vi.fn();
const recognizeReadingMock = vi.fn();
vi.mock('../../lib/photo-reading', async () => {
  const actual = await vi.importActual<typeof import('../../lib/photo-reading')>('../../lib/photo-reading');
  return {
    ...actual,
    readCaptureDate: (...args: unknown[]) => readCaptureDateMock(...args),
    recognizeReading: (...args: unknown[]) => recognizeReadingMock(...args),
  };
});

afterEach(cleanup);

const FILE = new File(['x'], 'surtidor.jpg', { type: 'image/jpeg' });

function renderModal(equipoId = 'eq_1') {
  const qc = new QueryClient();
  const onOpenChange = vi.fn();
  const utils = render(
    <QueryClientProvider client={qc}>
      <RegistrarCargaCombustibleModal equipoId={equipoId} equipoLabel="EX-001" isOpen onOpenChange={onOpenChange} />
    </QueryClientProvider>,
  );
  return { onOpenChange, qc, ...utils };
}

function subirFoto() {
  const input = document.querySelector('input[type="file"]') as HTMLInputElement;
  fireEvent.change(input, { target: { files: [FILE] } });
}

describe('RegistrarCargaCombustibleModal', () => {
  beforeEach(() => {
    mutateMock.mockReset();
    isPending = false;
    uploadImageMock.mockReset();
    readCaptureDateMock.mockReset();
    recognizeReadingMock.mockReset();
    readCaptureDateMock.mockResolvedValue(null);
    recognizeReadingMock.mockResolvedValue({ value: '', confidence: 0 });
    uploadImageMock.mockResolvedValue('/uploads/surtidor.jpg');
  });

  it('el botón guardar está deshabilitado mientras no haya foto', () => {
    renderModal();
    const guardar = screen.getByRole('button', { name: 'Registrar carga' });
    expect(guardar.hasAttribute('disabled')).toBe(true);
  });

  it('al capturar la foto autorrellena los litros por OCR', async () => {
    recognizeReadingMock.mockResolvedValue({ value: '80', confidence: 95 });
    readCaptureDateMock.mockResolvedValue(new Date());

    renderModal();
    subirFoto();

    await waitFor(() => expect(screen.getByText('Autorrellenado por OCR · 95%')).toBeTruthy());
    expect(screen.getByText(/reciente/)).toBeTruthy();
  });

  it('sube la foto y guarda con el payload esperado (incluye fotoUrl)', async () => {
    recognizeReadingMock.mockResolvedValue({ value: '80', confidence: 90 });
    readCaptureDateMock.mockResolvedValue(null);

    const { onOpenChange } = renderModal();
    subirFoto();

    await waitFor(() => expect(recognizeReadingMock).toHaveBeenCalled());
    await waitFor(() => expect(screen.queryByText('Analizando la foto…')).toBeNull());

    const guardar = screen.getByRole('button', { name: 'Registrar carga' });
    await waitFor(() => expect(guardar.hasAttribute('disabled')).toBe(false));
    fireEvent.click(guardar);

    await waitFor(() => expect(uploadImageMock).toHaveBeenCalledWith(FILE));
    await waitFor(() => expect(mutateMock).toHaveBeenCalledTimes(1));

    const [payload, options] = mutateMock.mock.calls[0];
    expect(payload).toMatchObject({
      equipoId: 'eq_1',
      litros: 80,
      tipo: 'PETROLEO',
      fotoUrl: '/uploads/surtidor.jpg',
    });

    options.onSuccess();
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('si la subida de la foto falla, no llama al hook de creación', async () => {
    recognizeReadingMock.mockResolvedValue({ value: '80', confidence: 90 });
    readCaptureDateMock.mockResolvedValue(null);
    uploadImageMock.mockRejectedValue(new Error('network error'));

    renderModal();
    subirFoto();
    await waitFor(() => expect(recognizeReadingMock).toHaveBeenCalled());

    const guardar = screen.getByRole('button', { name: 'Registrar carga' });
    await waitFor(() => expect(guardar.hasAttribute('disabled')).toBe(false));
    fireEvent.click(guardar);

    await waitFor(() => expect(uploadImageMock).toHaveBeenCalled());
    expect(mutateMock).not.toHaveBeenCalled();
  });

  it('mientras la foto está subiendo, Cancelar (y el botón X) quedan deshabilitados', async () => {
    recognizeReadingMock.mockResolvedValue({ value: '80', confidence: 90 });
    readCaptureDateMock.mockResolvedValue(null);
    // Sube "para siempre" dentro del test — lo que importa es el estado
    // mientras la promesa sigue pendiente, no su resolución.
    uploadImageMock.mockImplementation(() => new Promise(() => {}));

    renderModal();
    subirFoto();
    await waitFor(() => expect(recognizeReadingMock).toHaveBeenCalled());

    const guardar = screen.getByRole('button', { name: 'Registrar carga' });
    await waitFor(() => expect(guardar.hasAttribute('disabled')).toBe(false));
    fireEvent.click(guardar);

    await waitFor(() => expect(uploadImageMock).toHaveBeenCalled());
    const cancelar = screen.getByRole('button', { name: 'Cancelar' });
    await waitFor(() => expect(cancelar.hasAttribute('disabled')).toBe(true));
    // El botón Guardar también queda bloqueado (evita doble submit mientras sube).
    expect(guardar.hasAttribute('disabled')).toBe(true);
  });

  it('mientras la mutación está pendiente, Guardar y Cancelar quedan deshabilitados', async () => {
    recognizeReadingMock.mockResolvedValue({ value: '80', confidence: 90 });
    readCaptureDateMock.mockResolvedValue(null);
    isPending = true;

    renderModal();
    subirFoto();
    await waitFor(() => expect(recognizeReadingMock).toHaveBeenCalled());

    // Con `isPending` el botón muestra un spinner en vez del texto "Registrar
    // carga", así que acá se busca por el atributo `form` en vez de por
    // nombre accesible.
    const guardar = document.querySelector('button[form="registrar-carga-form"]') as HTMLButtonElement;
    const cancelar = screen.getByRole('button', { name: 'Cancelar' });
    await waitFor(() => expect(guardar.hasAttribute('disabled')).toBe(true));
    expect(cancelar.hasAttribute('disabled')).toBe(true);
  });

  it('Cancelar limpia el estado — reabrir el mismo modal para otro equipo no arrastra la foto anterior', async () => {
    recognizeReadingMock.mockResolvedValue({ value: '80', confidence: 95 });
    readCaptureDateMock.mockResolvedValue(new Date());

    const { onOpenChange, qc, rerender } = renderModal('eq_1');
    subirFoto();
    await waitFor(() => expect(screen.getByText('Autorrellenado por OCR · 95%')).toBeTruthy());

    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(onOpenChange).toHaveBeenCalledWith(false);

    rerender(
      <QueryClientProvider client={qc}>
        <RegistrarCargaCombustibleModal
          equipoId="eq_2"
          equipoLabel="EX-002"
          isOpen={false}
          onOpenChange={onOpenChange}
        />
      </QueryClientProvider>,
    );
    rerender(
      <QueryClientProvider client={qc}>
        <RegistrarCargaCombustibleModal equipoId="eq_2" equipoLabel="EX-002" isOpen onOpenChange={onOpenChange} />
      </QueryClientProvider>,
    );

    expect(screen.queryByText(/Autorrellenado por OCR/)).toBeNull();
    expect(screen.queryByText(/reciente/)).toBeNull();
    const guardar = screen.getByRole('button', { name: 'Registrar carga' });
    expect(guardar.hasAttribute('disabled')).toBe(true);
  });
});
