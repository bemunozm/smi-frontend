import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const { listMineMock } = vi.hoisted(() => ({ listMineMock: vi.fn() }));

vi.mock('../api/ShiftCardAPI', () => ({
  ShiftCardAPI: { listMine: listMineMock },
}));

import { mensajeErrorTarjeta, SHIFT_CARDS_MINE_KEY, useShiftCardsMine } from './useShiftCards';
import { DomainError } from '../lib/api-error';

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

describe('mensajeErrorTarjeta', () => {
  it('EQUIPMENT_BUSY: muestra el mensaje del backend tal cual (trae quién y desde cuándo)', () => {
    const error = new DomainError('CA-011 está ocupado por Marcela Pizarro desde las 07:40', {
      code: 'EQUIPMENT_BUSY',
    });
    expect(mensajeErrorTarjeta(error)).toBe('CA-011 está ocupado por Marcela Pizarro desde las 07:40');
  });

  it('HOURMETER_BELOW_INITIAL: usa el texto amigable mapeado por code', () => {
    const error = new DomainError('mensaje técnico', { code: 'HOURMETER_BELOW_INITIAL' });
    expect(mensajeErrorTarjeta(error)).toBe('El horómetro final no puede ser menor que el inicial.');
  });

  // Fase 5 (revisión offline) — códigos nuevos del backend/del propio replay.
  it.each([
    ['INVALID_SHIFT_DATE', 'La fecha del turno no es válida — revisá la fecha y la hora del equipo.'],
    ['REPORT_RATE_LIMITED', 'Se mandaron demasiados reportes seguidos — esperá unos minutos y reintentá.'],
    ['PHOTO_MISSING', 'Falta la foto guardada para este cierre — descartalo y volvé a cerrar la tarjeta.'],
    ['INVALID_RESPONSE', 'Respuesta inesperada del servidor — reintentá más tarde o avisá si sigue pasando.'],
    [
      'CARD_NOT_FOUND',
      'La tarjeta no existe en el servidor (su apertura no llegó). Revisá la apertura pendiente o descartá este cierre.',
    ],
  ])('%s: usa el texto amigable mapeado por code', (code, esperado) => {
    expect(mensajeErrorTarjeta(new DomainError('mensaje técnico', { code }))).toBe(esperado);
  });

  it('sin code ni DomainError, cae al mensaje genérico de Error', () => {
    expect(mensajeErrorTarjeta(new Error('boom'))).toBe('boom');
  });

  it('un valor no-Error cae al fallback genérico', () => {
    expect(mensajeErrorTarjeta('rareza')).toBe('No se pudo completar la operación.');
  });
});
