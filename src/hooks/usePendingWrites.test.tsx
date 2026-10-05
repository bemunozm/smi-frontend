import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, renderHook } from '@testing-library/react';

import type { OutboxOp } from '../offline/db';

let ops: OutboxOp[] = [];
vi.mock('../offline/useOutboxOps', () => ({ useOutboxOps: () => ops }));
vi.mock('./useCurrentUser', () => ({ useCurrentUser: () => ({ user: { id: 'u1' } }) }));

import { usePendingWrites } from './usePendingWrites';

afterEach(() => {
  cleanup();
  ops = [];
});

function escritura(id: string, endpoint: string, entityKey: string, status: 'pending' | 'needs_attention' = 'pending'): OutboxOp {
  return {
    id,
    type: 'httpWrite',
    v: 1,
    userId: 'u1',
    endpoint,
    params: {},
    body: {},
    label: id,
    status,
    attempts: 0,
    seq: 1,
    entityKey,
    createdAt: 1,
    updatedAt: 1,
  } as unknown as OutboxOp;
}

describe('usePendingWrites', () => {
  it('la marca de una fila se pide por tipo e id: la clave de la cola no sale del hook', () => {
    ops = [escritura('a', 'equipment.update', 'equipment:e1'), escritura('b', 'item.update', 'item:i1', 'needs_attention')];
    const { result } = renderHook(() => usePendingWrites());

    expect(result.current.marcaDe('equipment', 'e1')).toBe('pendiente');
    expect(result.current.marcaDe('item', 'i1')).toBe('atencion');
    expect(result.current.marcaDe('equipment', 'otro')).toBeNull();
    expect(result.current.marcaDe('orden', 'e1')).toBeNull();
  });

  it('filtra por la familia de la escritura', () => {
    ops = [escritura('a', 'equipment.update', 'equipment:e1'), escritura('b', 'orden.update', 'orden:o1')];
    const { result } = renderHook(() => usePendingWrites(['orden']));

    expect(result.current.ops.map((op) => op.id)).toEqual(['b']);
    expect(result.current.pendientes).toBe(1);
  });

  it('cuenta aparte lo que espera una acción', () => {
    ops = [escritura('a', 'equipment.update', 'equipment:e1'), escritura('b', 'equipment.status', 'equipment:e2', 'needs_attention')];
    const { result } = renderHook(() => usePendingWrites(['equipment']));

    expect(result.current.pendientes).toBe(1);
    expect(result.current.atencion).toBe(1);
  });

  it('una operación que requiere atención gana sobre una pendiente de la misma fila', () => {
    ops = [escritura('a', 'equipment.update', 'equipment:e1'), escritura('b', 'equipment.status', 'equipment:e1', 'needs_attention')];
    const { result } = renderHook(() => usePendingWrites());

    expect(result.current.marcaDe('equipment', 'e1')).toBe('atencion');
  });
});
