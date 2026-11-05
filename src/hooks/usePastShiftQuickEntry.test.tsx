import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const { enqueueOpenCardMock, enqueueCloseCardMock, toastDangerMock } = vi.hoisted(() => ({
  enqueueOpenCardMock: vi.fn(),
  enqueueCloseCardMock: vi.fn(),
  toastDangerMock: vi.fn(),
}));
vi.mock('../offline/outbox', () => ({
  enqueueOpenCard: enqueueOpenCardMock,
  enqueueCloseCard: enqueueCloseCardMock,
}));
vi.mock('@heroui/react', () => ({ toast: { danger: toastDangerMock, success: vi.fn() } }));
vi.mock('../lib/outbox-feedback', () => ({ avisarGuardadoEnCola: vi.fn() }));

import { usePastShiftQuickEntry } from './usePastShiftQuickEntry';
import { contextoDeTurno } from '../lib/turno';
import type { Equipment } from '../types/equipment';

afterEach(() => vi.clearAllMocks());

const CTX = contextoDeTurno('DIURNO', new Date(2026, 9, 20)); // 2026-10-20
const EQUIPOS = [
  { id: 'e1', internalCode: 'SEM-02', type: 'Semirremolque', currentHourmeter: 4600 },
  { id: 'e2', internalCode: 'SEM-04', type: 'Semirremolque', currentHourmeter: 3180 },
] as Equipment[];

function hook() {
  return renderHook(() =>
    usePastShiftQuickEntry({ ctx: CTX, disponibles: EQUIPOS, userId: 'u1' }),
  );
}

describe('usePastShiftQuickEntry', () => {
  it('guardar() encola apertura + cierre SIN foto por cada fila completa, en orden', async () => {
    const { result } = hook();

    act(() => {
      result.current.setFila(0, {
        equipoId: 'e1',
        operatorId: 'op_1',
        inicial: '4526,0',
        final: '4533,7',
        litros: '167',
      });
      result.current.agregarFila();
    });
    act(() => {
      result.current.setFila(1, {
        equipoId: 'e2',
        operatorId: 'op_2',
        inicial: '3059,1',
        final: '3069,1',
        litros: '',
      });
    });

    expect(result.current.puedeGuardar).toBe(true);
    await act(async () => {
      expect(await result.current.guardar()).toBe(true);
    });

    expect(enqueueOpenCardMock).toHaveBeenCalledTimes(2);
    expect(enqueueCloseCardMock).toHaveBeenCalledTimes(2);

    const [, open1] = enqueueOpenCardMock.mock.calls[0]!;
    expect(open1).toMatchObject({
      equipoId: 'e1',
      operatorId: 'op_1',
      valorInicial: 4526,
      shiftDate: '2026-10-20',
      shiftType: 'DIURNO',
    });
    const [, cardId1, close1, foto1] = enqueueCloseCardMock.mock.calls[0]!;
    expect(cardId1).toBe(open1.id); // el cierre apunta a la apertura de SU fila
    expect(close1).toMatchObject({ valorFinal: 4533.7, fuelLiters: 167 });
    expect(foto1).toBeUndefined(); // carga histórica: sin foto

    // Litros vacío = turno sin carga (0 L).
    const [, , close2] = enqueueCloseCardMock.mock.calls[1]!;
    expect(close2).toMatchObject({ valorFinal: 3069.1, fuelLiters: 0 });

    // Tras guardar, la grilla vuelve a una fila vacía.
    expect(result.current.filas).toHaveLength(1);
    expect(result.current.filas[0].equipoId).toBe('');
  });

  it('una fila incompleta bloquea el guardado y lo dice', () => {
    const { result } = hook();

    act(() => {
      result.current.setFila(0, { equipoId: 'e1', inicial: '100' });
    });

    expect(result.current.puedeGuardar).toBe(false);
    expect(result.current.errorDeFila(0)).toMatch(/operador/i);
  });

  it('final menor que inicial marca error en la fila', () => {
    const { result } = hook();

    act(() => {
      result.current.setFila(0, {
        equipoId: 'e1',
        operatorId: 'op_1',
        inicial: '200',
        final: '150',
        litros: '10',
      });
    });

    expect(result.current.errorDeFila(0)).toMatch(/final/i);
    expect(result.current.puedeGuardar).toBe(false);
  });

  it('un equipo elegido en una fila no se ofrece en las demás', () => {
    const { result } = hook();

    act(() => {
      result.current.setFila(0, { equipoId: 'e1' });
      result.current.agregarFila();
    });

    expect(result.current.equiposDeFila(1).map((e) => e.id)).toEqual(['e2']);
    // La propia fila sigue viendo su equipo elegido.
    expect(result.current.equiposDeFila(0).map((e) => e.id)).toContain('e1');
  });
});
