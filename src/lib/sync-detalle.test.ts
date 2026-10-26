import { describe, expect, it } from 'vitest';

import { detalleOp, mensajeLegible, queHacer } from './sync-detalle';
import type { OutboxOp } from '../offline/db';

const base = { v: 1, userId: 'u1', attempts: 0, createdAt: 1, updatedAt: 1 };

/** El caso real del 26/10: cierre rechazado por litros, y la apertura siguiente choca. */
const cierre = {
  ...base,
  id: 'c1',
  seq: 1,
  type: 'closeCard',
  status: 'needs_attention',
  photoId: 'c1',
  payload: {
    cardId: 'card-mb008',
    input: { closeClientId: 'c1', valorFinal: 29700, fuelLiters: 29700, capturedAt: '2026-10-26T13:15:00.000Z' },
  },
  lastError: { status: 400, message: 'fuelLiters must not be greater than 10000' },
} as unknown as OutboxOp;

const apertura = {
  ...base,
  id: 'a2',
  seq: 2,
  type: 'openCard',
  status: 'needs_attention',
  payload: { id: 'a2', equipoId: 'eq-mb008', valorInicial: 29700, capturedAt: '2026-10-26T13:16:00.000Z' },
  lastError: {
    status: 409,
    code: 'EQUIPMENT_BUSY',
    message: 'El equipo ya tiene una tarjeta de turno abierta por Mantenedor SMI desde el 26-10-2026, 09:44',
  },
} as unknown as OutboxOp;

describe('sync-detalle', () => {
  it('traduce la validación del servidor que llega en inglés', () => {
    expect(mensajeLegible('fuelLiters must not be greater than 10000')).toBe('Litros: no puede superar 10.000.');
    expect(mensajeLegible('valorFinal must not be less than 0, fuelLiters must be a number')).toBe(
      'Lectura final: no puede ser menor que 0. Litros: tiene que ser un número.',
    );
    // Lo que ya viene en español pasa tal cual.
    expect(mensajeLegible('El equipo no está operativo')).toBe('El equipo no está operativo');
  });

  it('el detalle dice qué se guardó: lecturas, litros', () => {
    expect(detalleOp(cierre)).toMatch(/^Lectura final 29\.700 · 29\.700 L · 26-10 \d\d:15$/);
    expect(detalleOp(apertura)).toMatch(/^Lectura inicial 29\.700 · 26-10 \d\d:16$/);
  });

  it('qué hacer: un cierre con un dato inválido se descarta y se vuelve a cerrar', () => {
    expect(queHacer(cierre, [cierre, apertura])).toMatch(/^Un dato no es válido/);
  });

  it('qué hacer: la apertura choca porque el cierre de arriba no pasó', () => {
    expect(queHacer(apertura, [cierre, apertura])).toMatch(/el cierre de arriba no pasó/);
    // Sin un cierre trabado antes, es que otra persona tiene el equipo.
    expect(queHacer(apertura, [apertura])).toMatch(/^Alguien más tiene el equipo abierto/);
  });
});
