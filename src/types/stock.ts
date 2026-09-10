import { z } from 'zod';

import { TIPOS_INSUMO, UNIDADES_INSUMO, type TipoInsumo } from './inventario';

/**
 * Contrato de la consulta de inventario **por bodega** (`/api/inventario/stock`)
 * — PROD-11 / RFC-11.
 *
 * Vive aparte de `types/inventario.ts` a propósito: aquél describe el MAESTRO
 * de insumos (la ficha y su total consolidado); éste describe el SALDO en una
 * sucursal, que es otra pregunta y tiene otro dueño en el backend.
 */
// Se reexportan para que la pantalla de stock tenga todo su vocabulario en un
// solo import; la definición sigue siendo única, en `inventario.ts`.
export { TIPOS_INSUMO };
export type { TipoInsumo };

export const StockEnSucursalSchema = z.object({
  insumoId: z.string(),
  codigo: z.string(),
  nombre: z.string(),
  descripcion: z.string().nullable(),
  unidad: z.enum(UNIDADES_INSUMO),
  tipo: z.enum(TIPOS_INSUMO),
  /** Saldo en la bodega consultada. */
  stock: z.number(),
  /** Saldo sumado de todas las bodegas. */
  stockTotal: z.number(),
  /** Umbral que aplica en esta bodega (propio o heredado del global). */
  stockMinimo: z.number(),
  /** `false` cuando esta bodega nunca ha manejado el insumo. */
  enBodega: z.boolean(),
  bajoMinimo: z.boolean(),
});
export type StockEnSucursal = z.infer<typeof StockEnSucursalSchema>;

export const StockListSchema = z.object({
  /** La bodega efectivamente consultada — el backend resuelve la principal. */
  sucursalId: z.string(),
  items: z.array(StockEnSucursalSchema),
});
export type StockList = z.infer<typeof StockListSchema>;

export const StockPorSucursalSchema = z.object({
  sucursalId: z.string(),
  sucursalCodigo: z.string(),
  sucursalNombre: z.string(),
  stock: z.number(),
  stockMinimo: z.number(),
  bajoMinimo: z.boolean(),
});
export type StockPorSucursal = z.infer<typeof StockPorSucursalSchema>;

/** `GET /api/inventario/insumos/:id/stock` — en qué bodegas está el insumo. */
export const DesgloseInsumoSchema = z.object({
  insumoId: z.string(),
  codigo: z.string(),
  nombre: z.string(),
  unidad: z.enum(UNIDADES_INSUMO),
  stockTotal: z.number(),
  sucursales: z.array(StockPorSucursalSchema),
});
export type DesgloseInsumo = z.infer<typeof DesgloseInsumoSchema>;

// --- Envolturas `{ data, message }` ---------------------------------------

export const StockListResponseSchema = z.object({
  data: StockListSchema,
  message: z.string(),
});

export const DesgloseInsumoResponseSchema = z.object({
  data: DesgloseInsumoSchema,
  message: z.string(),
});

export const SetStockMinimoResponseSchema = z.object({
  data: z.object({
    insumoId: z.string(),
    sucursalId: z.string(),
    stockMinimo: z.number(),
  }),
  message: z.string(),
});

export interface SetStockMinimoInput {
  insumoId: string;
  sucursalId: string;
  stockMinimo: number;
}

// --- Etiquetas -------------------------------------------------------------

export const TIPO_INSUMO_LABELS: Record<TipoInsumo, string> = {
  SUMINISTRO: 'Suministro',
  REPUESTO: 'Repuesto',
};

// La lectura "¿dónde está lo que necesito?" vive en `types/disponibilidad.ts`,
// compartida con la pantalla de repuestos compatibles: es la misma pregunta
// sobre la misma fila y no puede contestarse distinto según la pantalla.
