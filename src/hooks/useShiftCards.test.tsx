import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const { listMineMock } = vi.hoisted(() => ({ listMineMock: vi.fn() }));

vi.mock('../api/ShiftCardAPI', () => ({
  ShiftCardAPI: { listMine: listMineMock },
}));

import { useShiftCardsMine } from './useShiftCards';
import { SHIFT_CARDS_MINE_KEY } from '../lib/query-keys';

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

function withQueryClient(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

const CARD = {
  id: 'c1',
  equipoId: 'eq_1',
  equipo: { internalCode: 'EX-005', type: 'Excavadora', controlUnit: 'HOURS' },
  operatorId: 'op_1',
  operatorName: 'Patricio Rojas',
  supervisorId: 'u1',
  supervisorName: 'Ana Soto',
  shift: { id: 'sh_1', date: '2026-09-24', type: 'DIURNO', exitReports: [] },
  valorInicial: 100,
  valorFinal: null,
  horasMaquina: null,
  fuelLiters: null,
  pumpPhotoUrl: null,
  observaciones: null,
  belowPreviousReading: false,
  fecha: '2026-09-24T08:00:00.000Z',
  fechaSalida: null,
  createdAt: '2026-09-24T08:00:00.000Z',
  closedAt: null,
};

describe('useShiftCardsMine', () => {
  it('pide la lista bajo la queryKey ["shift-cards","mine"]', async () => {
    listMineMock.mockResolvedValueOnce([CARD]);
    const queryClient = new QueryClient();

    const { result } = renderHook(() => useShiftCardsMine(), { wrapper: withQueryClient(queryClient) });

    await waitFor(() => expect(result.current.data).toEqual([CARD]));
    expect(queryClient.getQueryData(SHIFT_CARDS_MINE_KEY)).toEqual([CARD]);
  });
});
