import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

const { getMock } = vi.hoisted(() => ({ getMock: vi.fn() }));
vi.mock('../lib/axios', () => ({ axiosInstance: { get: getMock } }));

import { usePastShiftSummary } from './usePastShiftSummary';

/** Respuesta REAL del backend local (05-11-2026) para un turno backfilleado —
 * pinea que el schema del resumen parsea lo que el servidor de verdad manda. */
const RESPUESTA_REAL = {
  data: [
    {
      id: 'cmw2yv01r0003usf43zvfd98d',
      date: '2026-11-03',
      type: 'DIURNO',
      supervisorId: 'TzcuvHu0XT9D6y4RTcoToSNvwU80L37y',
      exitReports: [],
      cards: [
        {
          id: '972360a1-2b1d-4541-9c0f-dd59c7554c25',
          equipoId: 'cmv88ojf0000lusdwi84ooztn',
          equipo: {
            internalCode: 'BD-005',
            type: 'Bulldozer',
            controlUnit: 'HOURS',
            equipmentClass: 'HEAVY',
          },
          operatorId: 'cmv88ogao003fus44fheo1eol',
          operatorName: 'Jorge Pizarro',
          valorInicial: 5009,
          valorFinal: 5017.5,
          horasMaquina: 8.5,
          fecha: '2026-11-03T15:00:00.000Z',
          fechaSalida: '2026-11-03T15:00:00.000Z',
        },
      ],
    },
  ],
  message: 'ok',
};

describe('usePastShiftSummary · integración con la respuesta real', () => {
  it('parsea la respuesta del servidor y entrega las tarjetas', async () => {
    getMock.mockResolvedValue({ data: RESPUESTA_REAL });
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const Wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    const { result } = renderHook(
      () => usePastShiftSummary({ fecha: new Date(2026, 10, 3), turno: 'DIURNO' }),
      { wrapper: Wrapper },
    );

    await waitFor(() => expect(result.current.isSuccess || result.current.isError).toBe(true));
    expect(result.current.error).toBeNull();
    expect(getMock).toHaveBeenCalledWith('/api/shifts', {
      params: { date: '2026-11-03', type: 'DIURNO' },
    });
    expect(result.current.data?.[0].cards[0].operatorName).toBe('Jorge Pizarro');
  });
});
