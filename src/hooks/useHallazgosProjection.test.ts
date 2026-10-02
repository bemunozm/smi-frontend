import { describe, expect, it } from 'vitest';

import { proyectarHallazgos } from './useHallazgosProjection';
import type { CreateHallazgoOp, CreateTrabajoExtraOp, OutboxOp } from '../offline/db';
import type { Equipment } from '../types/equipment';
import type { Hallazgo } from '../types/hallazgos';

const EQUIPOS = [{ id: 'eq-1', internalCode: 'EX-005', type: 'Excavadora' }] as Equipment[];

function servidor(id: string, fecha = '2026-09-24T08:00:00.000Z'): Hallazgo {
  return {
    id,
    equipoId: 'eq-1',
    descripcion: 'Del servidor',
    prioridad: 'BAJA',
    estado: 'EN_PROCESO',
    fotoUrl: null,
    fecha,
    equipo: { internalCode: 'EX-005' },
  };
}

function op(id: string, overrides: Partial<CreateHallazgoOp> = {}, capturedAt = '2026-09-24T09:00:00.000Z'): CreateHallazgoOp {
  return {
    id,
    type: 'createHallazgo',
    v: 1,
    userId: 'u1',
    status: 'pending',
    attempts: 0,
    createdAt: 1,
    updatedAt: 1,
    payload: { id, equipoId: 'eq-1', descripcion: 'Pendiente', prioridad: 'ALTA', capturedAt },
    ...overrides,
  };
}

describe('proyectarHallazgos', () => {
  it('un pendiente aparece como ABIERTO, sinSincronizar, con el código del equipo y la hora de captura', () => {
    const [h] = proyectarHallazgos([], [op('h-1')], EQUIPOS);

    expect(h).toMatchObject({
      id: 'h-1',
      estado: 'ABIERTO',
      prioridad: 'ALTA',
      descripcion: 'Pendiente',
      fecha: '2026-09-24T09:00:00.000Z',
      equipo: { internalCode: 'EX-005' },
      sinSincronizar: true,
      requiereAtencion: false,
      fotoPendiente: false,
    });
  });

  it('el servidor gana: un pendiente cuyo id ya está en la lista no se duplica', () => {
    const lista = proyectarHallazgos([servidor('h-1')], [op('h-1')], EQUIPOS);

    expect(lista).toHaveLength(1);
    expect(lista[0]).toMatchObject({ descripcion: 'Del servidor', estado: 'EN_PROCESO' });
    expect(lista[0]!.sinSincronizar).toBeUndefined();
  });

  it('los pendientes van primero (el más reciente arriba) y después los del servidor', () => {
    const lista = proyectarHallazgos(
      [servidor('s-1')],
      [op('viejo', {}, '2026-09-24T09:00:00.000Z'), op('nuevo', {}, '2026-09-24T10:00:00.000Z')],
      EQUIPOS,
    );

    expect(lista.map((h) => h.id)).toEqual(['nuevo', 'viejo', 's-1']);
  });

  it('con foto guardada, marca fotoPendiente; en needs_attention, requiereAtencion', () => {
    const [h] = proyectarHallazgos([], [op('h-1', { photoId: 'h-1', status: 'needs_attention' })], EQUIPOS);

    expect(h).toMatchObject({ fotoPendiente: true, requiereAtencion: true, sinSincronizar: true });
  });

  it('sin el equipo en el catálogo, el pendiente no rompe (cae al equipoId)', () => {
    const [h] = proyectarHallazgos([], [op('h-1')], []);

    expect(h!.equipo).toBeUndefined();
    expect(h!.equipoId).toBe('eq-1');
  });

  it('ignora operaciones de otro tipo', () => {
    const otra = {
      id: 'x',
      type: 'sendExitReport',
      v: 1,
      userId: 'u1',
      status: 'pending',
      attempts: 0,
      createdAt: 1,
      updatedAt: 1,
      payload: { id: 'x', shiftDate: '2026-09-24', shiftType: 'DIURNO', cardIds: [], requestedAt: 't' },
    } satisfies OutboxOp;
    const trabajo = { ...otra, id: 't', type: 'createTrabajoExtra' } as unknown as CreateTrabajoExtraOp;

    expect(proyectarHallazgos([], [otra, trabajo], EQUIPOS)).toEqual([]);
  });
});
