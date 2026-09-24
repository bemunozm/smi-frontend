import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { RegistrarCargaCombustibleModal } from './RegistrarCargaCombustibleModal';

const mutateMock = vi.fn();
let isPending = false;
vi.mock('../../hooks/useCombustible', () => ({
  useCreateCombustible: () => ({ mutate: mutateMock, isPending }),
}));

const uploadFileMock = vi.fn();
vi.mock('../../api/UploadsAPI', () => ({
  uploadFile: (...args: unknown[]) => uploadFileMock(...args),
}));

const readCaptureDateMock = vi.fn();
vi.mock('../../lib/photo-reading', async () => {
  const actual = await vi.importActual<typeof import('../../lib/photo-reading')>('../../lib/photo-reading');
  return {
    ...actual,
    readCaptureDate: (...args: unknown[]) => readCaptureDateMock(...args),
  };
});

const fuelReadingOcrMock = vi.fn();
vi.mock('../../api/OcrAPI', () => ({
  fuelReadingOcr: (...args: unknown[]) => fuelReadingOcrMock(...args),
}));

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
    uploadFileMock.mockReset();
    readCaptureDateMock.mockReset();
    fuelReadingOcrMock.mockReset();
    readCaptureDateMock.mockResolvedValue(null);
    fuelReadingOcrMock.mockResolvedValue({ value: null, status: 'UNREADABLE', confidence: 0 });
    uploadFileMock.mockResolvedValue({ key: 'tmp/u1/surtidor.jpg', url: 'https://minio.local/surtidor.jpg' });
  });

  it('el botón guardar está deshabilitado mientras no haya foto', () => {
    renderModal();
    const guardar = screen.getByRole('button', { name: 'Registrar carga' });
    expect(guardar.hasAttribute('disabled')).toBe(true);
  });

  it('CONFIRMED: autorrellena los litros y muestra el chip positivo', async () => {
    fuelReadingOcrMock.mockResolvedValue({ value: '80', status: 'CONFIRMED', confidence: 0.95 });
    readCaptureDateMock.mockResolvedValue(new Date());

    renderModal();
    subirFoto();

    await waitFor(() => expect(screen.getByText('Leído de la foto')).toBeTruthy());
    expect(screen.getByText(/reciente/)).toBeTruthy();
    // No se muestran los avisos de REVIEW/UNREADABLE.
    expect(screen.queryByText(/Verificá el valor/)).toBeNull();
    expect(screen.queryByText(/No se pudo leer/)).toBeNull();
  });

  it('REVIEW: autorrellena igual con la sugerencia, pero muestra el aviso de verificar en vez del chip positivo', async () => {
    fuelReadingOcrMock.mockResolvedValue({ value: '80.5', status: 'REVIEW', confidence: 0.6 });
    readCaptureDateMock.mockResolvedValue(new Date());

    renderModal();
    subirFoto();

    await waitFor(() => expect(fuelReadingOcrMock).toHaveBeenCalled());
    await waitFor(() => expect(screen.queryByText('Analizando la foto…')).toBeNull());

    // Aviso de REVIEW en vez del chip positivo de CONFIRMED.
    await waitFor(() => expect(screen.getByText(/Verificá el valor leído/)).toBeTruthy());
    expect(screen.queryByText(/^Leído de la foto/)).toBeNull();

    // Igual autorrellenó (litros > 0 sin que el usuario toque el campo):
    // Guardar ya queda habilitado y el payload lleva el valor sugerido.
    const guardar = screen.getByRole('button', { name: 'Registrar carga' });
    await waitFor(() => expect(guardar.hasAttribute('disabled')).toBe(false));
    fireEvent.click(guardar);

    await waitFor(() => expect(mutateMock).toHaveBeenCalledTimes(1));
    const [payload] = mutateMock.mock.calls[0];
    expect(payload.litros).toBe(80.5);
  });

  it('UNREADABLE (value: null): no autorrellena, muestra el aviso neutro y el campo queda editable a mano', async () => {
    fuelReadingOcrMock.mockResolvedValue({ value: null, status: 'UNREADABLE', confidence: 0 });
    readCaptureDateMock.mockResolvedValue(new Date());

    renderModal();
    subirFoto();

    await waitFor(() => expect(fuelReadingOcrMock).toHaveBeenCalled());
    await waitFor(() => expect(screen.queryByText('Analizando la foto…')).toBeNull());

    // Sin sugerencia: ni chip positivo ni aviso de REVIEW, sí el aviso
    // neutro de "no se pudo leer", y Guardar sigue deshabilitado (litros en
    // 0) hasta que el usuario lo cargue a mano.
    expect(screen.queryByText(/^Leído de la foto/)).toBeNull();
    expect(screen.queryByText(/Verificá el valor leído/)).toBeNull();
    expect(screen.getByText(/No se pudo leer la foto, ingresá los litros a mano/)).toBeTruthy();
    const guardar = screen.getByRole('button', { name: 'Registrar carga' });
    expect(guardar.hasAttribute('disabled')).toBe(true);

    // El campo sigue editable pese a no tener sugerencia — el usuario tipea.
    fireEvent.click(screen.getByRole('button', { name: 'Increase Litros' }));

    await waitFor(() => expect(guardar.hasAttribute('disabled')).toBe(false));
  });

  it('si el valor sugerido no es numérico (ej. varios puntos), no autorrellena aunque el status sea CONFIRMED', async () => {
    fuelReadingOcrMock.mockResolvedValue({ value: '183.08.9', status: 'CONFIRMED', confidence: 0.99 });
    readCaptureDateMock.mockResolvedValue(new Date());

    renderModal();
    subirFoto();

    // `Number("183.08.9")` da NaN — el guard existente no autorrellena, pero
    // el chip se decide por `status`, no por si el valor parseó: al ser
    // CONFIRMED se sigue mostrando el chip positivo.
    await waitFor(() => expect(screen.getByText('Leído de la foto')).toBeTruthy());
    expect(screen.queryByText(/Verificá el valor leído/)).toBeNull();
    const guardar = screen.getByRole('button', { name: 'Registrar carga' });
    expect(guardar.hasAttribute('disabled')).toBe(true);
  });

  it('sube la foto y guarda con el payload esperado (incluye fotoKey, no fotoUrl)', async () => {
    fuelReadingOcrMock.mockResolvedValue({ value: '80', status: 'CONFIRMED', confidence: 0.9 });
    readCaptureDateMock.mockResolvedValue(null);

    const { onOpenChange } = renderModal();
    subirFoto();

    await waitFor(() => expect(fuelReadingOcrMock).toHaveBeenCalled());
    await waitFor(() => expect(screen.queryByText('Analizando la foto…')).toBeNull());

    const guardar = screen.getByRole('button', { name: 'Registrar carga' });
    await waitFor(() => expect(guardar.hasAttribute('disabled')).toBe(false));
    fireEvent.click(guardar);

    await waitFor(() => expect(uploadFileMock).toHaveBeenCalledWith(FILE));
    await waitFor(() => expect(mutateMock).toHaveBeenCalledTimes(1));

    const [payload, options] = mutateMock.mock.calls[0];
    expect(payload).toMatchObject({
      equipoId: 'eq_1',
      litros: 80,
      tipo: 'PETROLEO',
      fotoKey: 'tmp/u1/surtidor.jpg',
    });
    expect('fotoUrl' in payload).toBe(false);

    options.onSuccess();
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('al elegir una foto con EXIF, "Fecha de carga" se pre-rellena con esa fecha de captura', async () => {
    fuelReadingOcrMock.mockResolvedValue({ value: '80', status: 'CONFIRMED', confidence: 0.9 });
    // 15/01/2026 10:30 local — el input datetime-local muestra componentes
    // locales, así que se arma la fecha esperada con los mismos getters que
    // usa el componente (evita asumir la zona horaria de la máquina de test).
    const exifDate = new Date(2026, 0, 15, 10, 30);
    readCaptureDateMock.mockResolvedValue(exifDate);

    renderModal();
    subirFoto();

    await waitFor(() => expect(fuelReadingOcrMock).toHaveBeenCalled());

    const fechaInput = document.querySelector('input[type="datetime-local"]') as HTMLInputElement;
    const pad = (n: number) => String(n).padStart(2, '0');
    const esperado = `${exifDate.getFullYear()}-${pad(exifDate.getMonth() + 1)}-${pad(exifDate.getDate())}T${pad(exifDate.getHours())}:${pad(exifDate.getMinutes())}`;
    await waitFor(() => expect(fechaInput.value).toBe(esperado));
  });

  it('sin EXIF (foto sin metadata), "Fecha de carga" se pre-rellena con la hora actual', async () => {
    fuelReadingOcrMock.mockResolvedValue({ value: '80', status: 'CONFIRMED', confidence: 0.9 });
    readCaptureDateMock.mockResolvedValue(null);

    renderModal();
    subirFoto();

    await waitFor(() => expect(fuelReadingOcrMock).toHaveBeenCalled());

    const fechaInput = document.querySelector('input[type="datetime-local"]') as HTMLInputElement;
    // Sin EXIF cae a "ahora": no queda vacío y respeta el formato datetime-local.
    await waitFor(() => expect(fechaInput.value).not.toBe(''));
    expect(fechaInput.value).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
  });

  it('la fecha pre-rellenada (editable) va en el payload al registrar', async () => {
    fuelReadingOcrMock.mockResolvedValue({ value: '80', status: 'CONFIRMED', confidence: 0.9 });
    const exifDate = new Date(2026, 0, 15, 10, 30);
    readCaptureDateMock.mockResolvedValue(exifDate);

    renderModal();
    subirFoto();

    await waitFor(() => expect(fuelReadingOcrMock).toHaveBeenCalled());
    const fechaInput = document.querySelector('input[type="datetime-local"]') as HTMLInputElement;
    const pad = (n: number) => String(n).padStart(2, '0');
    const localValue = `${exifDate.getFullYear()}-${pad(exifDate.getMonth() + 1)}-${pad(exifDate.getDate())}T${pad(exifDate.getHours())}:${pad(exifDate.getMinutes())}`;
    await waitFor(() => expect(fechaInput.value).toBe(localValue));

    const guardar = screen.getByRole('button', { name: 'Registrar carga' });
    await waitFor(() => expect(guardar.hasAttribute('disabled')).toBe(false));
    fireEvent.click(guardar);

    await waitFor(() => expect(mutateMock).toHaveBeenCalledTimes(1));
    const [payload] = mutateMock.mock.calls[0];
    expect(payload.fecha).toBe(new Date(localValue).toISOString());
  });

  it('si la subida de la foto falla, no llama al hook de creación', async () => {
    fuelReadingOcrMock.mockResolvedValue({ value: '80', status: 'CONFIRMED', confidence: 0.9 });
    readCaptureDateMock.mockResolvedValue(null);
    uploadFileMock.mockRejectedValue(new Error('network error'));

    renderModal();
    subirFoto();
    await waitFor(() => expect(fuelReadingOcrMock).toHaveBeenCalled());

    const guardar = screen.getByRole('button', { name: 'Registrar carga' });
    await waitFor(() => expect(guardar.hasAttribute('disabled')).toBe(false));
    fireEvent.click(guardar);

    await waitFor(() => expect(uploadFileMock).toHaveBeenCalled());
    expect(mutateMock).not.toHaveBeenCalled();
  });

  it('mientras la foto está subiendo, Cancelar (y el botón X) quedan deshabilitados', async () => {
    fuelReadingOcrMock.mockResolvedValue({ value: '80', status: 'CONFIRMED', confidence: 0.9 });
    readCaptureDateMock.mockResolvedValue(null);
    // Sube "para siempre" dentro del test — lo que importa es el estado
    // mientras la promesa sigue pendiente, no su resolución.
    uploadFileMock.mockImplementation(() => new Promise(() => {}));

    renderModal();
    subirFoto();
    await waitFor(() => expect(fuelReadingOcrMock).toHaveBeenCalled());

    const guardar = screen.getByRole('button', { name: 'Registrar carga' });
    await waitFor(() => expect(guardar.hasAttribute('disabled')).toBe(false));
    fireEvent.click(guardar);

    await waitFor(() => expect(uploadFileMock).toHaveBeenCalled());
    const cancelar = screen.getByRole('button', { name: 'Cancelar' });
    await waitFor(() => expect(cancelar.hasAttribute('disabled')).toBe(true));
    // El botón Guardar también queda bloqueado (evita doble submit mientras sube).
    expect(guardar.hasAttribute('disabled')).toBe(true);
  });

  it('mientras la mutación está pendiente, Guardar y Cancelar quedan deshabilitados', async () => {
    fuelReadingOcrMock.mockResolvedValue({ value: '80', status: 'CONFIRMED', confidence: 0.9 });
    readCaptureDateMock.mockResolvedValue(null);
    isPending = true;

    renderModal();
    subirFoto();
    await waitFor(() => expect(fuelReadingOcrMock).toHaveBeenCalled());

    // Con `isPending` el botón muestra un spinner en vez del texto "Registrar
    // carga", así que acá se busca por el atributo `form` en vez de por
    // nombre accesible.
    const guardar = document.querySelector('button[form="registrar-carga-form"]') as HTMLButtonElement;
    const cancelar = screen.getByRole('button', { name: 'Cancelar' });
    await waitFor(() => expect(guardar.hasAttribute('disabled')).toBe(true));
    expect(cancelar.hasAttribute('disabled')).toBe(true);
  });

  it('Cancelar limpia el estado — reabrir el mismo modal para otro equipo no arrastra la foto anterior', async () => {
    fuelReadingOcrMock.mockResolvedValue({ value: '80', status: 'CONFIRMED', confidence: 0.95 });
    readCaptureDateMock.mockResolvedValue(new Date());

    const { onOpenChange, qc, rerender } = renderModal('eq_1');
    subirFoto();
    await waitFor(() => expect(screen.getByText('Leído de la foto')).toBeTruthy());

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

    expect(screen.queryByText(/Leído de la foto/)).toBeNull();
    expect(screen.queryByText(/reciente/)).toBeNull();
    const guardar = screen.getByRole('button', { name: 'Registrar carga' });
    expect(guardar.hasAttribute('disabled')).toBe(true);
  });
});
