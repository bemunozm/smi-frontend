import { NUM_CL_1 } from '../../lib/dashboard-format';
import { UNIT_SYMBOLS, type UnitOfMeasure } from '../../types/inventory';
import type { ResumenDia } from '../../types/dashboard';

/** Número con el signo menos tipográfico («−20»), como se lee en el kardex. */
export function conSigno(n: number): string {
  return n < 0 ? `−${NUM_CL_1.format(Math.abs(n))}` : NUM_CL_1.format(n);
}

export interface AdBlueDisponible {
  /** El saldo listo para mostrar, con su signo: «−20». */
  valor: string;
  unidad: string;
  /** El mismo saldo en la unidad del ítem cuando se cuenta en bidones: «−2 u». */
  enUnidades: string | null;
  negativo: boolean;
}

/**
 * Saldo disponible de AdBlue en LITROS cuando se puede (las cargas se
 * declaran en litros): un ítem en bidones usa `stockLitros`, uno contado en
 * litros su propio `stock`. Sin conversión posible, queda en la unidad del
 * ítem. Puede ser negativo: las cargas descuentan aunque la bodega no alcance.
 */
export function adBlueDisponible(saldo: NonNullable<ResumenDia['adBlue']>): AdBlueDisponible {
  const simbolo = UNIT_SYMBOLS[saldo.unidad as UnitOfMeasure] ?? saldo.unidad;
  const litros = saldo.stockLitros ?? (saldo.unidad === 'LITER' ? saldo.stock : null);
  if (litros != null) {
    return {
      valor: conSigno(litros),
      unidad: 'L',
      enUnidades: saldo.stockLitros != null ? `${conSigno(saldo.stock)} ${simbolo}` : null,
      negativo: litros < 0,
    };
  }
  return { valor: conSigno(saldo.stock), unidad: simbolo, enUnidades: null, negativo: saldo.stock < 0 };
}
