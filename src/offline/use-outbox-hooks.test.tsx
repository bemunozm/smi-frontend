import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';

import { db, type OutboxOp } from './db';
import { useOfflineDb } from './useOfflineDb';
import { useOtherAccountsOpCount, useOutboxOps } from './useOutboxOps';

vi.mock('../lib/logger', () => ({ logger: { error: vi.fn() } }));

function op(id: string, userId: string, seq: number, createdAt: number): OutboxOp {
  return {
    id,
    type: 'sendExitReport',
    v: 1,
    userId,
    status: 'pending',
    attempts: 0,
    seq,
    createdAt,
    updatedAt: createdAt,
    payload: { id, shiftDate: '2026-10-05', shiftType: 'DIURNO', cardIds: [], requestedAt: 't' },
  } as OutboxOp;
}

beforeEach(async () => {
  await db.outbox.clear();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('useOutboxOps', () => {
  it('ordena por seq, el mismo orden en que el replay las manda, aunque el reloj haya retrocedido', async () => {
    // `createdAt` en contra de `seq`: un reloj que retrocedió entre dos guardados.
    await db.outbox.bulkPut([op('segunda', 'u1', 20, 100), op('primera', 'u1', 10, 900), op('tercera', 'u1', 30, 500)]);

    const { result } = renderHook(() => useOutboxOps('u1'));

    await waitFor(() => expect(result.current.map((o) => o.id)).toEqual(['primera', 'segunda', 'tercera']));
  });

  it('solo las del usuario, y vacío sin sesión', async () => {
    await db.outbox.bulkPut([op('mia', 'u1', 1, 1), op('ajena', 'u2', 2, 2)]);

    const { result } = renderHook(() => useOutboxOps('u1'));
    const sinSesion = renderHook(() => useOutboxOps(undefined));

    await waitFor(() => expect(result.current.map((o) => o.id)).toEqual(['mia']));
    expect(sinSesion.result.current).toEqual([]);
  });
});

describe('useOtherAccountsOpCount', () => {
  it('cuenta lo de las demás cuentas, solo la cantidad', async () => {
    await db.outbox.bulkPut([op('mia', 'u1', 1, 1), op('a', 'u2', 2, 2), op('b', 'u3', 3, 3)]);

    const { result } = renderHook(() => useOtherAccountsOpCount('u1'));

    await waitFor(() => expect(result.current).toBe(2));
  });

  it('se actualiza en vivo cuando otra cuenta deja algo', async () => {
    const { result } = renderHook(() => useOtherAccountsOpCount('u1'));
    await waitFor(() => expect(result.current).toBe(0));

    await act(async () => {
      await db.outbox.put(op('a', 'u2', 1, 1));
    });

    await waitFor(() => expect(result.current).toBe(1));
  });
});

describe('useOfflineDb', () => {
  it('abre la base y queda ready', async () => {
    const { result } = renderHook(() => useOfflineDb());

    await waitFor(() => expect(result.current.status).toBe('ready'));
  });

  it('si la base no abre (migración fallida, cuota llena) queda failed, y retry vuelve a intentarlo', async () => {
    const open = vi.spyOn(db, 'open').mockRejectedValueOnce(new Error('QuotaExceededError'));

    const { result } = renderHook(() => useOfflineDb());
    await waitFor(() => expect(result.current.status).toBe('failed'));

    act(() => result.current.retry());

    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(open).toHaveBeenCalledTimes(2);
  });
});
