/**
 * Dónde está lo que necesito: la lectura compartida entre la pantalla de stock
 * por sucursal (PROD-11) y la de repuestos compatibles (PROD-12).
 *
 * Las dos responden la misma pregunta sobre la misma fila, así que la regla vive
 * una sola vez. Cuando estaba duplicada, un cambio en una de las dos habría
 * hecho que la misma existencia apareciera distinta según la pantalla desde la
 * que se mirara.
 *
 * Toma números sueltos y no un objeto de dominio a propósito: los dos contratos
 * nombran distinto sus campos (`stock` vs `stockSucursal`) y forzar una forma
 * común obligaría a un adaptador en cada llamada.
 */
export type Disponibilidad = 'en-bodega' | 'en-otra' | 'sin-stock';

/**
 * Se decide por el SALDO, nunca por el mínimo de reposición: **tener poco no es
 * no tener**. Que además haya que reponer es otra alerta (`bajoMinimo`) y viaja
 * en un chip aparte.
 *
 * Mezclarlas tenía dos consecuencias malas, una en cada dirección: mandaba a
 * pedir un repuesto que ya estaba en la mano ("quedan 2" mostrado como "no
 * hay"), y —tras corregir la regla del mínimo por bodega— dejaba un ítem con
 * cero unidades mostrado como disponible cuando esa bodega no tenía umbral
 * configurado.
 */
export function disponibilidad(
  saldoEnBodega: number,
  saldoTotal: number,
): Disponibilidad {
  if (saldoEnBodega > 0) return 'en-bodega';
  return saldoTotal > 0 ? 'en-otra' : 'sin-stock';
}

/**
 * Un vocabulario único para los tres casos. Cada uno lleva a una acción
 * distinta, y por eso no se colapsan en "hay / no hay": usar lo que está acá,
 * pedir un traslado, o comprar.
 */
export const DISPONIBILIDAD_LABELS: Record<Disponibilidad, string> = {
  'en-bodega': 'En esta bodega',
  'en-otra': 'En otra sucursal',
  'sin-stock': 'Sin stock',
};

export type DisponibilidadColor = 'success' | 'warning' | 'danger';

export const DISPONIBILIDAD_COLORS: Record<Disponibilidad, DisponibilidadColor> =
  {
    'en-bodega': 'success',
    'en-otra': 'warning',
    'sin-stock': 'danger',
  };
