import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, cleanup, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { CombustibleView } from './CombustibleView';

// Terreno sigue en el flujo legacy: `PhotoDropzone` (`components/terreno/
// mobile.tsx`) sube con `uploadImage`/`POST /api/uploads`, y el submit manda
// `fotoUrl` — NUNCA `fotoKey` (eso es solo Flota, ver
// `RegistrarCargaCombustibleModal`). Se mockea la capa de API (no el hook)
// para que `useCreateCombustible` corra de verdad, mismo criterio que
// `EquiposView.interactions.test.tsx`.
const { uploadImageMock } = vi.hoisted(() => ({ uploadImageMock: vi.fn() }));
vi.mock('../api/UploadsAPI', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api/UploadsAPI')>();
  return { ...actual, uploadImage: uploadImageMock };
});

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

  it('Terreno sigue subiendo la foto con uploadImage y mandando fotoUrl (no fotoKey) — regresión R2-storage', async () => {
    uploadImageMock.mockResolvedValue('/uploads/surtidor.jpg');

    const qc = new QueryClient({ defaultOptions: { queries: { staleTime: Infinity, retry: false } } });
    qc.setQueryData(['equipment'], [{ id: 'e1', internalCode: 'EX-001', type: 'Excavadora' }]);
    qc.setQueryData(['combustible'], []);

    render(
      <QueryClientProvider client={qc}>
        <CombustibleView />
      </QueryClientProvider>,
    );

    const select = document.querySelector('select') as HTMLSelectElement;
    fireEvent.change(select, { target: { value: 'e1' } });

    const litros = screen.getByPlaceholderText('0');
    fireEvent.change(litros, { target: { value: '10' } });

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    const foto = new File(['x'], 'surtidor.jpg', { type: 'image/jpeg' });
    fireEvent.change(fileInput, { target: { files: [foto] } });

    await waitFor(() => expect(uploadImageMock).toHaveBeenCalledWith(foto));

    fireEvent.click(screen.getByText('Registrar carga'));

    await waitFor(() => expect(createCombustibleMock).toHaveBeenCalledTimes(1));
    const [body] = createCombustibleMock.mock.calls[0];
    expect(body).toMatchObject({ equipoId: 'e1', litros: 10, fotoUrl: '/uploads/surtidor.jpg' });
    expect('fotoKey' in body).toBe(false);
  });
});
