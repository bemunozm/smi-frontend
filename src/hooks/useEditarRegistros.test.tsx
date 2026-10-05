import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';

vi.mock('@heroui/react', () => ({ toast: { danger: vi.fn(), success: vi.fn() } }));
vi.mock('./useCurrentUser', () => ({ useCurrentUser: () => ({ user: { id: 'u1' } }) }));

let mockOps: OutboxOp[] = [];
vi.mock('../offline/useOutboxOps', () => ({ useOutboxOps: () => mockOps }));

import { useEditarHallazgo } from './useHallazgos';
import { useEditarTrabajoExtra } from './useTrabajosExtra';
import { db, type OutboxOp } from '../offline/db';
import { discardOp } from '../offline/outbox';
import type { Hallazgo } from '../types/hallazgos';
import type { TrabajoExtraForm, TrabajoExtraordinario } from '../types/trabajosExtra';

const hallazgo: Hallazgo = {
  id: 'h-1', equipoId: 'e1', descripcion: 'Fuga', prioridad: 'ALTA', estado: 'ABIERTO', fotoUrl: null, fecha: 't',
};

const trabajo: TrabajoExtraordinario = {
  id: 't-1', equipoId: 'e1', operatorId: 'op-1', operador: 'X', faena: 'Patillo', turno: 'DIURNO', horometroInicial: 1,
  horometroFinal: 2, totalHoras: 1, actividades: ['OTRO'], otraActividad: 'x', descripcion: 'abc', observaciones: null, fecha: 't',
};

const formTrabajo: TrabajoExtraForm = {
  equipoId: 'e1', operatorId: 'op-1', faena: 'Patillo', turno: 'DIURNO', horometroInicial: 1, horometroFinal: 3,
  actividades: ['OTRO'], otraActividad: 'x', descripcion: 'abc',
};

const correccion = { equipoId: 'e1', descripcion: 'Fuga', prioridad: 'CRITICA', estado: 'ABIERTO' };

function creacion(type: 'createHallazgo' | 'createTrabajoExtra', id: string, entityKey: string): OutboxOp {
  return {
    id, type, v: 1, userId: 'u1', status: 'pending', attempts: 0, seq: 1, createdAt: 1, updatedAt: 1, entityKey,
    payload: { id },
  } as unknown as OutboxOp;
}

beforeEach(async () => {
  mockOps = [];
  await db.outbox.clear();
});
afterEach(() => vi.clearAllMocks());

describe('editar un hallazgo / trabajo extra cuya creación sigue en el outbox', () => {
  it('hallazgo: la edición depende de la creación pendiente', async () => {
    mockOps = [creacion('createHallazgo', 'h-1', 'hallazgo:h-1')];
    const { result } = renderHook(() => useEditarHallazgo());

    await act(async () => {
      await result.current.guardar(hallazgo, correccion);
    });

    expect(await db.outbox.toArray()).toMatchObject([
      { endpoint: 'hallazgo.edit', entityKey: 'hallazgo:h-1', dependsOn: ['h-1'] },
    ]);
  });

  it('trabajo extra: la edición depende de la creación pendiente', async () => {
    mockOps = [creacion('createTrabajoExtra', 't-1', 'trabajo-extra:t-1')];
    const { result } = renderHook(() => useEditarTrabajoExtra());

    await act(async () => {
      await result.current.guardar(trabajo, formTrabajo);
    });

    expect(await db.outbox.toArray()).toMatchObject([{ endpoint: 'trabajoExtra.edit', dependsOn: ['t-1'] }]);
  });

  it('sin creación pendiente (ya sincronizado) no lleva dependsOn', async () => {
    const { result } = renderHook(() => useEditarHallazgo());

    await act(async () => {
      await result.current.guardar(hallazgo, correccion);
    });

    expect((await db.outbox.toArray())[0]).not.toHaveProperty('dependsOn');
  });

  it('descartar la creación arrastra la edición: no queda huérfana', async () => {
    const create = creacion('createHallazgo', 'h-1', 'hallazgo:h-1');
    await db.outbox.put({ ...create, status: 'needs_attention' });
    mockOps = [create];
    const { result } = renderHook(() => useEditarHallazgo());
    await act(async () => {
      await result.current.guardar(hallazgo, correccion);
    });
    expect(await db.outbox.count()).toBe(2);

    await discardOp('h-1', 'u1');

    expect(await db.outbox.count()).toBe(0);
  });
});
