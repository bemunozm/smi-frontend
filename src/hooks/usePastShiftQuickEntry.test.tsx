import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const { enqueueClosedCardMock, enqueueClosedCardPairMock, toastDangerMock } = vi.hoisted(() => ({
  enqueueClosedCardMock: vi.fn(),
  enqueueClosedCardPairMock: vi.fn(),
  toastDangerMock: vi.fn(),
}));
vi.mock('../offline/outbox', () => ({
  enqueueClosedCard: enqueueClosedCardMock,
  enqueueClosedCardPair: enqueueClosedCardPairMock,
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

function hook(checklistSinAceptar?: ReadonlyMap<string, string>, esDiaPasado = true) {
  return renderHook(() =>
    usePastShiftQuickEntry({ ctx: CTX, disponibles: EQUIPOS, userId: 'u1', checklistSinAceptar, esDiaPasado }),
  );
}

const FOTO = new File([new Uint8Array([1, 2, 3])], 'surtidor.jpg', { type: 'image/jpeg' });

describe('usePastShiftQuickEntry', () => {
  it('guardar() encola apertura + cierre por fila, cada una con SU foto', async () => {
    const { result } = hook();

    act(() => {
      result.current.setFila(0, {
        equipoId: 'e1',
        operatorId: 'op_1',
        inicial: '4526,0',
        final: '4533,7',
        litros: '167',
        foto: FOTO,
      });
      result.current.agregarFila();
    });
    const FOTO_2 = new File([new Uint8Array([4, 5])], 'carga2.jpg', { type: 'image/jpeg' });
    act(() => {
      result.current.setFila(1, {
        equipoId: 'e2',
        operatorId: 'op_2',
        inicial: '3059,1',
        final: '3069,1',
        litros: '',
        foto: FOTO_2,
      });
    });

    expect(result.current.puedeGuardar).toBe(true);
    await act(async () => {
      expect(await result.current.guardar()).toBe(true);
    });

    expect(enqueueClosedCardMock).toHaveBeenCalledTimes(2);

    const [, open1, close1, foto1] = enqueueClosedCardMock.mock.calls[0]!;
    expect(open1).toMatchObject({
      equipoId: 'e1',
      operatorId: 'op_1',
      valorInicial: 4526,
      shiftDate: '2026-10-20',
      shiftType: 'DIURNO',
    });
    expect(close1).toMatchObject({ valorFinal: 4533.7, fuelLiters: 167 });
    expect(foto1).toBe(FOTO); // cada fila viaja con SU foto

    // Litros vacío = turno sin carga (0 L) — la foto va igual (obligatoria).
    const [, , close2, foto2] = enqueueClosedCardMock.mock.calls[1]!;
    expect(close2).toMatchObject({ valorFinal: 3069.1, fuelLiters: 0 });
    expect(foto2).toBe(FOTO_2);

    // Tras guardar, la grilla vuelve a una fila vacía.
    expect(result.current.filas).toHaveLength(1);
    expect(result.current.filas[0].equipoId).toBe('');
  });

  it('si el encolado de una fila falla, guardar() devuelve false, avisa y no deja la fila a medias', async () => {
    enqueueClosedCardMock.mockRejectedValueOnce(new Error('Foto inválida'));
    const { result } = hook();

    act(() => {
      result.current.setFila(0, {
        equipoId: 'e1',
        operatorId: 'op_1',
        inicial: '100',
        final: '110',
        litros: '5',
        foto: FOTO,
      });
    });

    await act(async () => {
      expect(await result.current.guardar()).toBe(false);
    });

    expect(toastDangerMock).toHaveBeenCalledWith('Foto inválida');
    // Una sola operación atómica por fila: no hay apertura suelta que limpiar.
    expect(enqueueClosedCardMock).toHaveBeenCalledTimes(1);
    // La fila fallida sigue en la grilla para corregirla y reintentar.
    expect(result.current.filas).toHaveLength(1);
    expect(result.current.filas[0].equipoId).toBe('e1');
  });

  it('si falla la 2ª fila, la 1ª no se vuelve a encolar al reintentar', async () => {
    enqueueClosedCardMock.mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error('Sin espacio'));
    const { result } = hook();
    const FOTO_2 = new File([new Uint8Array([4, 5])], 'carga2.jpg', { type: 'image/jpeg' });

    act(() => {
      result.current.setFila(0, {
        equipoId: 'e1',
        operatorId: 'op_1',
        inicial: '100',
        final: '110',
        litros: '5',
        foto: FOTO,
      });
      result.current.agregarFila();
    });
    act(() => {
      result.current.setFila(1, {
        equipoId: 'e2',
        operatorId: 'op_2',
        inicial: '200',
        final: '210',
        litros: '',
        foto: FOTO_2,
      });
    });

    await act(async () => {
      expect(await result.current.guardar()).toBe(false);
    });

    expect(enqueueClosedCardMock).toHaveBeenCalledTimes(2);
    // Solo queda la fila que falló.
    expect(result.current.filas).toHaveLength(1);
    expect(result.current.filas[0].equipoId).toBe('e2');

    await act(async () => {
      expect(await result.current.guardar()).toBe(true);
    });

    expect(enqueueClosedCardMock).toHaveBeenCalledTimes(3);
    const [, openReintento] = enqueueClosedCardMock.mock.calls[2]!;
    expect(openReintento).toMatchObject({ equipoId: 'e2' });
    const equiposEncolados = enqueueClosedCardMock.mock.calls.map(([, open]) => open.equipoId);
    expect(equiposEncolados.filter((id) => id === 'e1')).toHaveLength(1);
  });

  it('editar una fila ya encolada durante el guardado no la deja en la grilla ni se re-encola al reintentar', async () => {
    let liberarPrimera!: () => void;
    enqueueClosedCardMock
      .mockImplementationOnce(() => new Promise<void>((resolve) => (liberarPrimera = resolve)))
      .mockRejectedValueOnce(new Error('Sin espacio'));
    const { result } = hook();
    const FOTO_2 = new File([new Uint8Array([4, 5])], 'carga2.jpg', { type: 'image/jpeg' });

    act(() => {
      result.current.setFila(0, {
        equipoId: 'e1',
        operatorId: 'op_1',
        inicial: '100',
        final: '110',
        litros: '5',
        foto: FOTO,
      });
      result.current.agregarFila();
    });
    act(() => {
      result.current.setFila(1, {
        equipoId: 'e2',
        operatorId: 'op_2',
        inicial: '200',
        final: '210',
        litros: '',
        foto: FOTO_2,
      });
    });

    let guardado!: Promise<boolean>;
    act(() => {
      guardado = result.current.guardar();
    });
    // La fila 1 ya está en vuelo: editarla reemplaza su objeto.
    act(() => {
      result.current.setFila(0, { litros: '999' });
    });
    await act(async () => {
      liberarPrimera();
      expect(await guardado).toBe(false);
    });

    expect(result.current.filas).toHaveLength(1);
    expect(result.current.filas[0].equipoId).toBe('e2');

    await act(async () => {
      expect(await result.current.guardar()).toBe(true);
    });

    const equiposEncolados = enqueueClosedCardMock.mock.calls.map(([, open]) => open.equipoId);
    expect(equiposEncolados).toEqual(['e1', 'e2', 'e2']);
  });

  it('el turno terminado de HOY (esDiaPasado=false) va por el par legacy apertura+cierre, nunca por /closed', async () => {
    const { result } = hook(undefined, false);

    act(() => {
      result.current.setFila(0, {
        equipoId: 'e1',
        operatorId: 'op_1',
        inicial: '4526',
        final: '4533',
        litros: '100',
        foto: FOTO,
      });
    });
    await act(() => result.current.guardar());

    expect(enqueueClosedCardMock).not.toHaveBeenCalled();
    expect(enqueueClosedCardPairMock).toHaveBeenCalledTimes(1);
    const [userId, open, close, foto] = enqueueClosedCardPairMock.mock.calls[0]!;
    expect(userId).toBe('u1');
    expect(open).toMatchObject({ equipoId: 'e1', operatorId: 'op_1', valorInicial: 4526, shiftDate: '2026-10-20' });
    expect(close).toMatchObject({ valorFinal: 4533, fuelLiters: 100 });
    expect(foto).toBe(FOTO);
  });

  it('un día estrictamente pasado (esDiaPasado=true) va como tarjeta que nace cerrada', async () => {
    const { result } = hook();

    act(() => {
      result.current.setFila(0, {
        equipoId: 'e1',
        operatorId: 'op_1',
        inicial: '100',
        final: '110',
        litros: '',
        foto: FOTO,
      });
    });
    await act(() => result.current.guardar());

    expect(enqueueClosedCardPairMock).not.toHaveBeenCalled();
    expect(enqueueClosedCardMock).toHaveBeenCalledTimes(1);
  });

  it('las filas nuevas no comparten identidad: cada una trae su propia key', () => {
    const { result } = hook();

    act(() => {
      result.current.agregarFila();
      result.current.agregarFila();
    });

    const keys = result.current.filas.map((f) => f.key);
    expect(new Set(keys).size).toBe(3);
  });

  it('un equipo con el checklist sin aceptar bloquea la fila y dice por qué', () => {
    const { result } = hook(new Map([['e1', 'Checklist por validar (Checklists)']]));

    act(() => {
      result.current.setFila(0, {
        equipoId: 'e1',
        operatorId: 'op_1',
        inicial: '100',
        final: '110',
        litros: '5',
        foto: FOTO,
      });
    });

    expect(result.current.errorDeFila(0)).toBe(
      'No se puede registrar este equipo: Checklist por validar (Checklists).',
    );
    expect(result.current.puedeGuardar).toBe(false);
  });

  it('una fila válida con el checklist de OTRO equipo sin aceptar sigue guardable', () => {
    const { result } = hook(new Map([['e2', 'Checklist rechazado: falta que lo corrijan']]));

    act(() => {
      result.current.setFila(0, {
        equipoId: 'e1',
        operatorId: 'op_1',
        inicial: '100',
        final: '110',
        litros: '5',
        foto: FOTO,
      });
    });

    expect(result.current.errorDeFila(0)).toBeNull();
    expect(result.current.puedeGuardar).toBe(true);
  });

  it('una fila sin foto no se puede guardar y lo dice — aun sin litros', () => {
    const { result } = hook();

    act(() => {
      result.current.setFila(0, { equipoId: 'e1', operatorId: 'op_1', inicial: '100', final: '110', litros: '' });
    });

    expect(result.current.errorDeFila(0)).toMatch(/foto/i);
    expect(result.current.puedeGuardar).toBe(false);
  });

  it('litros: 100.000 se acepta, 100.001 se rechaza con el tope', () => {
    const { result } = hook();
    const base = { equipoId: 'e1', operatorId: 'op_1', inicial: '100', final: '110', foto: FOTO };

    act(() => result.current.setFila(0, { ...base, litros: '100000' }));
    expect(result.current.errorDeFila(0)).toBeNull();
    expect(result.current.puedeGuardar).toBe(true);

    act(() => result.current.setFila(0, { ...base, litros: '100001' }));
    expect(result.current.errorDeFila(0)).toMatch(/0 a 100.000/);
    expect(result.current.puedeGuardar).toBe(false);
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
      result.current.setFila(0, { equipoId: 'e1', operatorId: 'op_1', inicial: '200', final: '150', litros: '10' });
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
