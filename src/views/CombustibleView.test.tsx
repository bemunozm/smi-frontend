import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, cleanup, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { CombustibleView } from './CombustibleView';
import { encolado, submitWriteMock, ultimaEscritura } from '../test/office-write';

// La carga va por la cola de escrituras (`submitWrite`): la foto viaja como
// archivo de la operación y se sube al sincronizar, no al elegirla.
vi.mock('../offline/submit-write', async (importOriginal) =>
  (await import('../test/office-write')).conSubmitWriteFalso(await importOriginal()),
);

// El OCR de litros no se ejercita acá; sin mock pegaría contra `/api/ocr`.
const { fuelReadingOcrMock } = vi.hoisted(() => ({ fuelReadingOcrMock: vi.fn() }));
vi.mock('../api/OcrAPI', () => ({
  fuelReadingOcr: (...args: unknown[]) => fuelReadingOcrMock(...args),
}));

vi.mock('../api/CombustibleAPI', () => ({ listCombustible: () => Promise.resolve([]) }));

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

  it('encola la carga con la foto como archivo y sin fotoKey ni fotoUrl en el body', async () => {
    fuelReadingOcrMock.mockResolvedValue({ value: null, status: 'UNREADABLE', confidence: 0 });
    submitWriteMock.mockResolvedValue(encolado());

    renderView();

    fireEvent.change(document.querySelector('select') as HTMLSelectElement, { target: { value: 'e1' } });
    fireEvent.change(screen.getByPlaceholderText('0'), { target: { value: '10' } });

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    const foto = new File(['x'], 'surtidor.jpg', { type: 'image/jpeg' });
    fireEvent.change(fileInput, { target: { files: [foto] } });

    await waitFor(() => expect(screen.getByText('Registrar carga')).not.toHaveProperty('disabled', true));
    fireEvent.click(screen.getByText('Registrar carga'));

    await waitFor(() => expect(submitWriteMock).toHaveBeenCalledTimes(1));
    const { endpoint, input } = ultimaEscritura();
    expect(endpoint).toBe('combustible.create');
    expect(input).toMatchObject({
      body: { equipoId: 'e1', litros: 10, tipo: 'PETROLEO', id: expect.any(String) },
      files: [{ field: 'fotoKey', file: foto }],
    });
    expect(input.body).not.toHaveProperty('fotoKey');
    expect(input.body).not.toHaveProperty('fotoUrl');
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

    expect(submitWriteMock).not.toHaveBeenCalled();
    expect(screen.getByText('Falta la foto del surtidor para registrar la carga.')).toBeTruthy();
  });
});
