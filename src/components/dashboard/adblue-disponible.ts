import { NUM_CL_1 } from '../../lib/dashboard-format';
import { UNIT_SYMBOLS, type UnitOfMeasure } from '../../types/inventory';
import type { ResumenDia } from '../../types/dashboard';

/** Número con el signo menos tipográfico («−20»), como se lee en el kardex. */
export function conSigno(n: number): string {
  return n < 0 ? `−${NUM_CL_1.format(Math.abs(n))}` : NUM_CL_1.format(n);
}

export interface AdBlueDisponible {
  /** El saldo listo para mostrar, con su signo: «79,6» o «−2». */
  valor: string;
  unidad: string;
  /** El mismo saldo en litros cuando el ítem se cuenta en bidones: «796 L». */
  enLitros: string | null;
  negativo: boolean;
}

/**
 * Saldo disponible de AdBlue en la MISMA unidad con que lo lleva Inventario
 * (bidones: «79,6 u»), para que el número de la tarjeta sea el que el
 * administrador ve en la ficha del ítem. Si el ítem se cuenta en bidones,
 * los litros van aparte («= 796 L»). Puede ser negativo: las cargas
 * descuentan aunque la bodega no alcance.
 */
export function adBlueDisponible(saldo: NonNullable<ResumenDia['adBlue']>): AdBlueDisponible {
  return {
    valor: conSigno(saldo.stock),
    unidad: UNIT_SYMBOLS[saldo.unidad as UnitOfMeasure] ?? saldo.unidad,
    enLitros: saldo.stockLitros != null ? `${conSigno(saldo.stockLitros)} L` : null,
    negativo: saldo.stock < 0,
  };
}
