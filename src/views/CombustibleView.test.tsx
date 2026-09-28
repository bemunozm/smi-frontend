import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, cleanup, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { CombustibleView } from './CombustibleView';

// Terreno dejó el flujo legacy (`PhotoDropzone` + `uploadImage` + `POST
// /api/uploads`, que servía la foto sin sesión) y usa el mismo que Flota:
// `usePhotoCaptureFlow` sube por `uploadFile` al bucket privado y el submit
// manda `fotoKey`. Se mockea la capa de API (no el hook) para que
// `useCreateCombustible` corra de verdad, mismo criterio que
// `EquiposView.interactions.test.tsx`.
const { uploadFileMock } = vi.hoisted(() => ({ uploadFileMock: vi.fn() }));
vi.mock('../api/UploadsAPI', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api/UploadsAPI')>();
  return { ...actual, uploadFile: uploadFileMock };
});

// El OCR de litros no se ejercita acá; sin mock pegaría contra `/api/ocr`.
const { fuelReadingOcrMock } = vi.hoisted(() => ({ fuelReadingOcrMock: vi.fn() }));
vi.mock('../api/OcrAPI', () => ({
  fuelReadingOcr: (...args: unknown[]) => fuelReadingOcrMock(...args),
}));

const { createCombustibleMock } = vi.hoisted(() => ({ createCombustibleMock: vi.fn() }));
vi.mock('../api/CombustibleAPI', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api/CombustibleAPI')>();
  return {
    ...actual,
    listCombustible: () => Promise.resolve([]),
    createCombustible: (...args: unknown[]) => createCombustibleMock(...args),
  };
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

function renderView() {
  const qc = new QueryClient({ defaultOptions: { queries: { staleTime: Infinity, retry: false } } });
  qc.setQueryData(['equipment'], [{ id: 'e1', internalCode: 'EX-001', type: 'Excavadora' }]);
  qc.setQueryData(['combustible'], []);
  return render(
    <QueryClientProvider client={qc}>
      <CombustibleView />
    </QueryClientProvider>,
  );
}

describe('CombustibleView', () => {
  it('renderiza con datos sin lanzar', () => {
    const qc = new QueryClient();
    qc.setQueryData(
      ['equipment'],
      [{ id: 'e1', internalCode: 'EX-001', type: 'Excavadora' }],
    );
    qc.setQueryData(
      ['combustible'],
      [{ id: 'r1', equipoId: 'e1', litros: 120, tipo: 'PETROLEO', fotoUrl: null, fecha: '2026-08-01T09:20:00.000Z', equipo: { internalCode: 'EX-001' } }],
    );

    render(
      <QueryClientProvider client={qc}>
        <CombustibleView />
      </QueryClientProvider>,
    );

    expect(screen.getByText('Registrar carga')).toBeTruthy();
    expect(screen.getByText('Tipo de combustible')).toBeTruthy();
    expect(screen.getAllByText('EX-001').length).toBeGreaterThan(0);
  });

  it('sube la foto al bucket privado y manda fotoKey, no fotoUrl', async () => {
    fuelReadingOcrMock.mockResolvedValue({ value: null, status: 'UNREADABLE', confidence: 0 });
    uploadFileMock.mockResolvedValue({ key: 'tmp/u1/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee.jpg', url: 'https://firmada' });

    renderView();

    fireEvent.change(document.querySelector('select') as HTMLSelectElement, { target: { value: 'e1' } });
    fireEvent.change(screen.getByPlaceholderText('0'), { target: { value: '10' } });

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    const foto = new File(['x'], 'surtidor.jpg', { type: 'image/jpeg' });
    fireEvent.change(fileInput, { target: { files: [foto] } });

    // La subida ocurre al enviar, no al elegir la foto: si el supervisor se
    // arrepiente, no quedó nada en el bucket.
    await waitFor(() => expect(screen.getByText('Registrar carga')).not.toHaveProperty('disabled', true));
    fireEvent.click(screen.getByText('Registrar carga'));

    await waitFor(() => expect(createCombustibleMock).toHaveBeenCalledTimes(1));
    expect(uploadFileMock).toHaveBeenCalledWith(foto);

    const [body] = createCombustibleMock.mock.calls[0];
    expect(body).toMatchObject({ equipoId: 'e1', litros: 10 });
    expect(body.fotoUrl).toBeUndefined();
  });

  /**
   * El label siempre dijo «Requerida» pero nada lo exigía: una carga se podía
   * guardar sin respaldo fotográfico, que es justo lo que el cliente pidió
   * para poder auditarla.
   */
  it('no deja registrar la carga sin foto', () => {
    renderView();

    fireEvent.change(document.querySelector('select') as HTMLSelectElement, { target: { value: 'e1' } });
    fireEvent.change(screen.getByPlaceholderText('0'), { target: { value: '10' } });

    fireEvent.click(screen.getByText('Registrar carga'));

    expect(createCombustibleMock).not.toHaveBeenCalled();
    expect(screen.getByText('Falta la foto del surtidor para registrar la carga.')).toBeTruthy();
  });
});
