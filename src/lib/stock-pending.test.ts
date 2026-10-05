import { describe, expect, it } from 'vitest';

import type { HttpWriteOp } from '../offline/db';
import { existenciaConPendientes } from './stock-pending';

let secuencia = 0;

function op(endpoint: HttpWriteOp['endpoint'], body: HttpWriteOp['body']): HttpWriteOp {
  secuencia += 1;
  return {
    id: `op-${secuencia}`,
    type: 'httpWrite',
    v: 1,
    userId: 'u1',
    endpoint,
    params: {},
    body,
    label: 'x',
    status: 'pending',
    attempts: 0,
    seq: secuencia,
    createdAt: secuencia,
    updatedAt: secuencia,
  };
}

describe('existenciaConPendientes', () => {
  it('sin nada pendiente, es la que se ve', () => {
    expect(existenciaConPendientes(10, 'br_1', [])).toBe(10);
  });

  it('suma las entradas y resta las salidas de ESA bodega', () => {
    const ops = [
      op('movement.create', { branchId: 'br_1', direction: 'IN', quantity: 5 }),
      op('movement.create', { branchId: 'br_1', direction: 'OUT', quantity: 3 }),
      op('movement.create', { branchId: 'br_2', direction: 'OUT', quantity: 100 }),
    ];

    expect(existenciaConPendientes(10, 'br_1', ops)).toBe(12);
  });

  it('un traspaso resta en el origen y suma en el destino', () => {
    const ops = [op('stock.transfer', { sourceBranchId: 'br_1', destinationBranchId: 'br_2', quantity: 4 })];

    expect(existenciaConPendientes(10, 'br_1', ops)).toBe(6);
    expect(existenciaConPendientes(10, 'br_2', ops)).toBe(14);
    expect(existenciaConPendientes(10, 'br_3', ops)).toBe(10);
  });

  it('un conteo pendiente FIJA la existencia y lo que viene después parte de ahí', () => {
    const ops = [
      op('movement.create', { branchId: 'br_1', direction: 'OUT', quantity: 2 }),
      op('item.adjust', { branchId: 'br_1', countedQuantity: 20 }),
      op('movement.create', { branchId: 'br_1', direction: 'IN', quantity: 1 }),
    ];

    expect(existenciaConPendientes(10, 'br_1', ops)).toBe(21);
  });

  it('una cantidad que no es número no suma nada', () => {
    const ops = [op('movement.create', { branchId: 'br_1', direction: 'IN', quantity: 'x' })];

    expect(existenciaConPendientes(10, 'br_1', ops)).toBe(10);
  });
});
