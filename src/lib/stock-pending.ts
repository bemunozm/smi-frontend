import type { HttpWriteOp } from '../offline/db';

function numero(valor: unknown): number {
  return typeof valor === 'number' && Number.isFinite(valor) ? valor : 0;
}

/**
 * La existencia de una bodega con lo que ya está guardado en el equipo del mismo
 * ítem (`ops`, en el orden en que se mandarán) aplicado encima de la que
 * muestra la pantalla. Es la que va a tener el servidor cuando esas operaciones
 * lleguen y la que hay que declarar como `expectedQuantity` de un conteo: si
 * no, un conteo hecho tras un movimiento propio todavía pendiente chocaría con él.
 */
export function existenciaConPendientes(mostrada: number, branchId: string, ops: readonly HttpWriteOp[]): number {
  let existencia = mostrada;
  for (const op of ops) {
    const { body } = op;
    if (op.endpoint === 'movement.create' && body.branchId === branchId) {
      existencia += body.direction === 'IN' ? numero(body.quantity) : -numero(body.quantity);
    } else if (op.endpoint === 'stock.transfer') {
      if (body.sourceBranchId === branchId) existencia -= numero(body.quantity);
      if (body.destinationBranchId === branchId) existencia += numero(body.quantity);
    } else if (op.endpoint === 'item.adjust' && body.branchId === branchId) {
      existencia = numero(body.countedQuantity);
    }
  }
  return existencia;
}
