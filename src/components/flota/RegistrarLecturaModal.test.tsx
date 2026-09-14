import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { RegistrarLecturaModal } from './RegistrarLecturaModal';

const mutateMock = vi.fn();
let isPending = false;
vi.mock('../../hooks/useHorometro', () => ({
  useCreateHorometro: () => ({ mutate: mutateMock, isPending }),
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

const FILE = new File(['x'], 'horometro.jpg', { type: 'image/jpeg' });

function renderModal(equipoId = 'eq_1') {
  const qc = new QueryClient();
  const onOpenChange = vi.fn();
  const utils = render(
    <QueryClientProvider client={qc}>
      <RegistrarLecturaModal equipoId={equipoId} equipoLabel="EX-001" isOpen onOpenChange={onOpenChange} />
    </QueryClientProvider>,
  );
  return { onOpenChange, qc, ...utils };
}

/** El input de foto vive dentro de `PhotoCaptureField`; react-aria portea el
 * diálogo fuera del `container` de `render`, así que se busca en `document`. */
function subirFoto() {
  const input = document.querySelector('input[type="file"]') as HTMLInputElement;
  fireEvent.change(input, { target: { files: [FILE] } });
}

describe('RegistrarLecturaModal', () => {
  beforeEach(() => {
    mutateMock.mockReset();
    isPending = false;
    uploadImageMock.mockReset();
    readCaptureDateMock.mockReset();
    recognizeReadingMock.mockReset();
    readCaptureDateMock.mockResolvedValue(null);
    recognizeReadingMock.mockResolvedValue({ value: '', confidence: 0 });
    uploadImageMock.mockResolvedValue('/uploads/horometro.jpg');
  });

  it('el botón guardar está deshabilitado mientras no haya foto', () => {
    renderModal();
    const guardar = screen.getByRole('button', { name: 'Registrar lectura' });
    expect(guardar.hasAttribute('disabled')).toBe(true);
  });

  it('al capturar la foto corre OCR + EXIF: autorrellena la lectura y marca la foto como reciente', async () => {
    recognizeReadingMock.mockResolvedValue({ value: '1234', confidence: 91 });
    readCaptureDateMock.mockResolvedValue(new Date());

    renderModal();
    subirFoto();

    await waitFor(() => expect(screen.getByText('Autorrellenado por OCR · 91%')).toBeTruthy());
    expect(screen.getByText(/reciente/)).toBeTruthy();
  });

  it('marca ⚠ cuando la foto no es reciente', async () => {
    recognizeReadingMock.mockResolvedValue({ value: '900', confidence: 70 });
    readCaptureDateMock.mockResolvedValue(new Date(Date.now() - 3 * 24 * 60 * 60 * 1000));

    renderModal();
    subirFoto();

    await waitFor(() => expect(screen.getByText(/es la lectura actual/)).toBeTruthy());
  });

  it('sin EXIF muestra el aviso de que no se pudo validar la antigüedad', async () => {
    recognizeReadingMock.mockResolvedValue({ value: '500', confidence: 60 });
    readCaptureDateMock.mockResolvedValue(null);

    renderModal();
    subirFoto();

    await waitFor(() =>
      expect(screen.getByText(/no se pudo validar su antigüedad/)).toBeTruthy(),
    );
  });

  it('guarda con el payload esperado una vez que hay foto, lectura y operador (sin nivel de combustible tocado, no lo manda)', async () => {
    recognizeReadingMock.mockResolvedValue({ value: '500', confidence: 80 });
    readCaptureDateMock.mockResolvedValue(null);

    const { onOpenChange } = renderModal();
    subirFoto();

    // Espera a que termine de procesar la foto (gatilla el fin del análisis
    // OCR/EXIF, que es lo que habilita el resto del formulario).
    await waitFor(() => expect(recognizeReadingMock).toHaveBeenCalled());
    await waitFor(() => expect(screen.queryByText('Analizando la foto…')).toBeNull());

    fireEvent.change(screen.getByPlaceholderText('Nombre y apellido'), {
      target: { value: 'Juan Pérez' },
    });

    const guardar = screen.getByRole('button', { name: 'Registrar lectura' });
    await waitFor(() => expect(guardar.hasAttribute('disabled')).toBe(false));
    fireEvent.click(guardar);

    // Sube la foto ANTES de crear la lectura — mismo orden que combustible.
    await waitFor(() => expect(uploadImageMock).toHaveBeenCalledWith(FILE));
    await waitFor(() => expect(mutateMock).toHaveBeenCalledTimes(1));
    const [payload, options] = mutateMock.mock.calls[0];
    expect(payload).toMatchObject({
      equipoId: 'eq_1',
      operador: 'Juan Pérez',
      turno: 'DIURNO',
      valorInicial: 500,
      fotoUrl: '/uploads/horometro.jpg',
    });
    // El usuario nunca tocó el stepper de nivel de combustible — no debe
    // mandarse un 0% falso que enmascare el "último nivel" real de la ficha.
    expect(payload.nivelCombustible).toBeUndefined();

    // Simula el `onSuccess` del hook para confirmar que el modal se cierra.
    options.onSuccess();
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('si la subida de la foto falla, no llama al hook de creación', async () => {
    recognizeReadingMock.mockResolvedValue({ value: '500', confidence: 80 });
    readCaptureDateMock.mockResolvedValue(null);
    uploadImageMock.mockRejectedValue(new Error('network error'));

    renderModal();
    subirFoto();
    await waitFor(() => expect(recognizeReadingMock).toHaveBeenCalled());

    fireEvent.change(screen.getByPlaceholderText('Nombre y apellido'), {
      target: { value: 'Juan Pérez' },
    });

    const guardar = screen.getByRole('button', { name: 'Registrar lectura' });
    await waitFor(() => expect(guardar.hasAttribute('disabled')).toBe(false));
    fireEvent.click(guardar);

    await waitFor(() => expect(uploadImageMock).toHaveBeenCalled());
    expect(mutateMock).not.toHaveBeenCalled();
  });

  it('mientras la foto está subiendo, Cancelar (y el botón X) quedan deshabilitados', async () => {
    recognizeReadingMock.mockResolvedValue({ value: '500', confidence: 80 });
    readCaptureDateMock.mockResolvedValue(null);
    // Sube "para siempre" dentro del test — lo que importa es el estado
    // mientras la promesa sigue pendiente, no su resolución.
    uploadImageMock.mockImplementation(() => new Promise(() => {}));

    renderModal();
    subirFoto();
    await waitFor(() => expect(recognizeReadingMock).toHaveBeenCalled());

    fireEvent.change(screen.getByPlaceholderText('Nombre y apellido'), {
      target: { value: 'Juan Pérez' },
    });

    const guardar = screen.getByRole('button', { name: 'Registrar lectura' });
    await waitFor(() => expect(guardar.hasAttribute('disabled')).toBe(false));
    fireEvent.click(guardar);

    await waitFor(() => expect(uploadImageMock).toHaveBeenCalled());
    const cancelar = screen.getByRole('button', { name: 'Cancelar' });
    await waitFor(() => expect(cancelar.hasAttribute('disabled')).toBe(true));
    // El botón Guardar también queda bloqueado (evita doble submit mientras sube).
    expect(guardar.hasAttribute('disabled')).toBe(true);
  });

  it('si el usuario sí ingresa un nivel de combustible, lo incluye en el payload', async () => {
    recognizeReadingMock.mockResolvedValue({ value: '500', confidence: 80 });
    readCaptureDateMock.mockResolvedValue(null);

    renderModal();
    subirFoto();
    await waitFor(() => expect(recognizeReadingMock).toHaveBeenCalled());
    await waitFor(() => expect(screen.queryByText('Analizando la foto…')).toBeNull());

    fireEvent.change(screen.getByPlaceholderText('Nombre y apellido'), {
      target: { value: 'Juan Pérez' },
    });

    const incrementarNivel = screen.getByRole('button', { name: 'Increase Nivel de combustible (%, opcional)' });
    fireEvent.click(incrementarNivel);

    const guardar = screen.getByRole('button', { name: 'Registrar lectura' });
    await waitFor(() => expect(guardar.hasAttribute('disabled')).toBe(false));
    fireEvent.click(guardar);

    await waitFor(() => expect(mutateMock).toHaveBeenCalledTimes(1));
    const [payload] = mutateMock.mock.calls[0];
    expect(payload.nivelCombustible).toBe(1);
  });

  it('Cancelar limpia el estado — reabrir el mismo modal para otro equipo no arrastra la foto/lectura anterior', async () => {
    recognizeReadingMock.mockResolvedValue({ value: '1234', confidence: 91 });
    readCaptureDateMock.mockResolvedValue(new Date());

    const { onOpenChange, qc, rerender } = renderModal('eq_1');
    subirFoto();
    await waitFor(() => expect(screen.getByText('Autorrellenado por OCR · 91%')).toBeTruthy());

    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(onOpenChange).toHaveBeenCalledWith(false);

    // El padre cierra y vuelve a abrir el MISMO componente (no se desmonta:
    // así es como vive dentro de `EquipoDetalleView`) para OTRO equipo.
    rerender(
      <QueryClientProvider client={qc}>
        <RegistrarLecturaModal equipoId="eq_2" equipoLabel="EX-002" isOpen={false} onOpenChange={onOpenChange} />
      </QueryClientProvider>,
    );
    rerender(
      <QueryClientProvider client={qc}>
        <RegistrarLecturaModal equipoId="eq_2" equipoLabel="EX-002" isOpen onOpenChange={onOpenChange} />
      </QueryClientProvider>,
    );

    expect(screen.queryByText(/Autorrellenado por OCR/)).toBeNull();
    expect(screen.queryByText(/reciente/)).toBeNull();
    const guardar = screen.getByRole('button', { name: 'Registrar lectura' });
    expect(guardar.hasAttribute('disabled')).toBe(true);
  });

  it('mientras la mutación está pendiente, Guardar y Cancelar quedan deshabilitados (evita doble submit)', async () => {
    recognizeReadingMock.mockResolvedValue({ value: '500', confidence: 80 });
    readCaptureDateMock.mockResolvedValue(null);
    isPending = true;

    renderModal();
    subirFoto();
    await waitFor(() => expect(recognizeReadingMock).toHaveBeenCalled());

    fireEvent.change(screen.getByPlaceholderText('Nombre y apellido'), {
      target: { value: 'Juan Pérez' },
    });

    // Con `isPending` el botón muestra un spinner en vez del texto "Registrar
    // lectura" (ver el render-prop `{ isPending }` del `Button`), así que acá
    // se busca por el atributo `form` en vez de por nombre accesible.
    const guardar = document.querySelector('button[form="registrar-lectura-form"]') as HTMLButtonElement;
    const cancelar = screen.getByRole('button', { name: 'Cancelar' });
    await waitFor(() => expect(guardar.hasAttribute('disabled')).toBe(true));
    expect(cancelar.hasAttribute('disabled')).toBe(true);
  });
});
