import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const { createHistorica } = vi.hoisted(() => ({ createHistorica: vi.fn() }));
vi.mock('../api/MantenimientoAPI', () => ({ OrdenesAPI: { createHistorica } }));
vi.mock('@heroui/react', () => ({ toast: { success: vi.fn(), danger: vi.fn() } }));

import { MAINTENANCE_PLANS_KEY } from '../lib/query-keys';
import { useRegistrarMantencionHistorica } from './useOrdenes';

afterEach(cleanup);

describe('useRegistrarMantencionHistorica', () => {
  it('al registrar refresca la pizarra y el pronóstico (raíz de las pautas)', async () => {
    createHistorica.mockResolvedValue({ titulo: 'Mantención 500 h' });
    const queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
    const invalidar = vi.spyOn(queryClient, 'invalidateQueries');
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
    const { result } = renderHook(() => useRegistrarMantencionHistorica(), { wrapper });
    result.current.mutate({ equipoId: 'e1', fecha: '2026-01-10', titulo: 'x', milestone: 500, lectura: 510 });
    await waitFor(() => expect(createHistorica).toHaveBeenCalled());
    await waitFor(() =>
      expect(invalidar).toHaveBeenCalledWith(expect.objectContaining({ queryKey: MAINTENANCE_PLANS_KEY })),
    );
  });
});
