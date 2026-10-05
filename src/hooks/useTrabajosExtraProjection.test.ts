import { describe, expect, it } from 'vitest';

import { proyectarTrabajosExtra } from './useTrabajosExtraProjection';
import type { CreateTrabajoExtraOp } from '../offline/db';
import type { Equipment } from '../types/equipment';
import type { Operator } from '../types/operator';
import type { TrabajoExtraordinario } from '../types/trabajosExtra';

const EQUIPOS = [{ id: 'eq-1', internalCode: 'EX-005', type: 'Excavadora' }] as Equipment[];
const OPERADORES = [{ id: 'op-1', name: 'Rodrigo Paredes' }] as Operator[];

function servidor(id: string): TrabajoExtraordinario {
  return {
    id,
    equipoId: 'eq-1',
    operatorId: 'op-1',
    operador: 'Nombre del servidor',
    faena: 'Kainita',
    turno: 'NOCTURNO',
    horometroInicial: 1,
    horometroFinal: 2,
    totalHoras: 1,
    actividades: ['OTRO'],
    otraActividad: 'Algo',
    descripcion: 'Del servidor',
    observaciones: null,
    fecha: '2026-09-24T08:00:00.000Z',
    equipo: { internalCode: 'EX-005' },
  };
}

function op(
  id: string,
  payload: Partial<CreateTrabajoExtraOp['payload']> = {},
  overrides: Partial<CreateTrabajoExtraOp> = {},
): CreateTrabajoExtraOp {
  return {
    id,
    type: 'createTrabajoExtra',
    v: 1,
    userId: 'u1',
    status: 'pending',
    attempts: 0,
    createdAt: 1,
    updatedAt: 1,
    payload: {
      id,
      equipoId: 'eq-1',
      operatorId: 'op-1',
      faena: 'Patillo',
      turno: 'DIURNO',
      horometroInicial: 100,
      horometroFinal: 112.5,
      actividades: ['SOLTAR_MATERIAL'],
      descripcion: 'Pendiente',
      capturedAt: '2026-09-24T09:00:00.000Z',
      ...payload,
    },
    ...overrides,
  };
}

describe('proyectarTrabajosExtra', () => {
  it('un pendiente resuelve equipo y operador desde los catálogos y calcula totalHoras', () => {
    const [t] = proyectarTrabajosExtra([], [op('t-1')], EQUIPOS, OPERADORES);

    expect(t).toMatchObject({
      id: 't-1',
      equipo: { internalCode: 'EX-005' },
      operador: 'Rodrigo Paredes',
      totalHoras: 12.5,
      faena: 'Patillo',
      turno: 'DIURNO',
      fecha: '2026-09-24T09:00:00.000Z',
      otraActividad: null,
      observaciones: null,
      sinSincronizar: true,
      requiereAtencion: false,
    });
  });

  it('totalHoras se redondea a 2 decimales como en el servidor', () => {
    const [t] = proyectarTrabajosExtra(
      [],
      [op('t-1', { horometroInicial: 0.1, horometroFinal: 0.4 })],
      EQUIPOS,
      OPERADORES,
    );

    expect(t!.totalHoras).toBe(0.3);
  });

  it('recorta otraActividad/observaciones vacías a null', () => {
    const [t] = proyectarTrabajosExtra(
      [],
      [op('t-1', { otraActividad: '  ', observaciones: '  nota  ' })],
      EQUIPOS,
      OPERADORES,
    );

    expect(t!.otraActividad).toBeNull();
    expect(t!.observaciones).toBe('nota');
  });

  it('el servidor gana: un pendiente cuyo id ya está en la lista no se duplica', () => {
    const lista = proyectarTrabajosExtra([servidor('t-1')], [op('t-1')], EQUIPOS, OPERADORES);

    expect(lista).toHaveLength(1);
    expect(lista[0]!.operador).toBe('Nombre del servidor');
    expect(lista[0]!.sinSincronizar).toBeUndefined();
  });

  it('los pendientes van primero, el más reciente arriba', () => {
    const lista = proyectarTrabajosExtra(
      [servidor('s-1')],
      [op('viejo'), op('nuevo', { capturedAt: '2026-09-24T11:00:00.000Z' })],
      EQUIPOS,
      OPERADORES,
    );

    expect(lista.map((t) => t.id)).toEqual(['nuevo', 'viejo', 's-1']);
  });

  it('en needs_attention marca requiereAtencion; sin catálogos no rompe', () => {
    const [t] = proyectarTrabajosExtra([], [op('t-1', {}, { status: 'needs_attention' })], [], []);

    expect(t).toMatchObject({ requiereAtencion: true, operador: 'Operador' });
    expect(t!.equipo).toBeUndefined();
  });
});
