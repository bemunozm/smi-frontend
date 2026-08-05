import { z } from 'zod';

/**
 * Contrato del dominio Inventario (`/api/inventario/insumos`,
 * `/api/inventario/movimientos`). Los tres vocabularios de abajo son los mismos
 * enums del backend (`UnidadInsumo`, `TipoMovimiento`, `OrigenMovimiento`).
 */
export const UNIDADES_INSUMO = ['UNIDAD', 'LITRO', 'KILOGRAMO', 'METRO'] as const;
export type UnidadInsumo = (typeof UNIDADES_INSUMO)[number];

export const TIPOS_MOVIMIENTO = ['ENTRADA', 'SALIDA'] as const;
export type TipoMovimiento = (typeof TIPOS_MOVIMIENTO)[number];

/** Cubre 1:1 la tabla de tipos de movimiento del documento (§5.1). */
export const ORIGENES_MOVIMIENTO = [
  'COMPRA',
  'DEVOLUCION',
  'AJUSTE_FISICO',
  'INTERVENCION',
  'ACTIVIDAD',
  'TRABAJO_EXTRAORDINARIO',
] as const;
export type OrigenMovimiento = (typeof ORIGENES_MOVIMIENTO)[number];

export const InsumoSchema = z.object({
  id: z.string(),
  codigo: z.string(),
  nombre: z.string(),
  descripcion: z.string().nullable(),
  unidad: z.enum(UNIDADES_INSUMO),
  stock: z.number(),
  stockMinimo: z.number(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type Insumo = z.infer<typeof InsumoSchema>;

/** Un insumo está "bajo stock" cuando alcanzó o cruzó su mínimo. */
export function estaBajoMinimo(insumo: Insumo): boolean {
  return insumo.stock <= insumo.stockMinimo;
}

export const MovimientoSchema = z.object({
  id: z.string(),
  insumoId: z.string(),
  tipo: z.enum(TIPOS_MOVIMIENTO),
  origen: z.enum(ORIGENES_MOVIMIENTO),
  cantidad: z.number(),
  saldoResultante: z.number(),
  responsableId: z.string().nullable(),
  equipoId: z.string().nullable(),
  referenciaId: z.string().nullable(),
  observacion: z.string().nullable(),
  fecha: z.string().datetime(),
  equipo: z.object({ id: z.string(), codigo: z.string() }).nullable().optional(),
});
export type Movimiento = z.infer<typeof MovimientoSchema>;

/** `GET /api/inventario/insumos/:id/kardex` — insumo + su historial completo. */
export const KardexSchema = z.object({
  insumo: InsumoSchema,
  movimientos: z.array(MovimientoSchema),
});
export type Kardex = z.infer<typeof KardexSchema>;

export const ResumenInventarioSchema = z.object({
  total: z.number().int().nonnegative(),
  bajoMinimo: z.number().int().nonnegative(),
});
export type ResumenInventario = z.infer<typeof ResumenInventarioSchema>;

// --- Envolturas `{ data, message }` ---------------------------------------

export const InsumoListResponseSchema = z.object({
  data: z.array(InsumoSchema),
  message: z.string(),
});

export const InsumoResponseSchema = z.object({
  data: InsumoSchema,
  message: z.string(),
});

export const KardexResponseSchema = z.object({
  data: KardexSchema,
  message: z.string(),
});

export const ResumenInventarioResponseSchema = z.object({
  data: ResumenInventarioSchema,
  message: z.string(),
});

export const MovimientoResponseSchema = z.object({
  data: MovimientoSchema,
  message: z.string(),
});

/** `POST /api/inventario/insumos/:id/ajuste` → insumo actualizado + el movimiento
 *  generado, que es `null` cuando el conteo coincidía con el sistema. */
export const AjusteResponseSchema = z.object({
  data: z.object({
    insumo: InsumoSchema,
    movimiento: MovimientoSchema.nullable(),
  }),
  message: z.string(),
});

export const DeleteInsumoResponseSchema = z.object({
  data: z.object({ id: z.string() }).nullable(),
  message: z.string(),
});

// --- Formularios (RHF + zodResolver) --------------------------------------

/** Campo numérico de formulario: string en el input, número al enviar. */
const cantidadField = (mensaje: string) =>
  z
    .string()
    .min(1, mensaje)
    .refine((value) => Number.isFinite(Number(value)) && Number(value) >= 0, {
      message: 'Ingresa un número válido',
    });

export const InsumoFormSchema = z.object({
  codigo: z.string().min(1, 'El código es obligatorio').max(20, 'Máximo 20 caracteres'),
  nombre: z.string().min(1, 'El nombre es obligatorio').max(80),
  descripcion: z.string().max(240).or(z.literal('')),
  unidad: z.enum(UNIDADES_INSUMO),
  stock: cantidadField('El stock inicial es obligatorio'),
  stockMinimo: cantidadField('El stock mínimo es obligatorio'),
});
export type InsumoFormValues = z.infer<typeof InsumoFormSchema>;

export interface CreateInsumoInput {
  codigo: string;
  nombre: string;
  descripcion?: string;
  unidad: UnidadInsumo;
  stock?: number;
  stockMinimo: number;
}

/** `stock` no se puede editar: solo se mueve con movimientos o ajuste. */
export type UpdateInsumoInput = Omit<CreateInsumoInput, 'codigo' | 'stock'>;

export function toInsumoPayload(values: InsumoFormValues): CreateInsumoInput {
  return {
    codigo: values.codigo.trim().toUpperCase(),
    nombre: values.nombre.trim(),
    // Se omite en vez de mandar `''`: con `forbidNonWhitelisted` + `@MaxLength`
    // el string vacío pasaría, pero deja basura en la base.
    ...(values.descripcion.trim() ? { descripcion: values.descripcion.trim() } : {}),
    unidad: values.unidad,
    stock: Number(values.stock),
    stockMinimo: Number(values.stockMinimo),
  };
}

export const MovimientoFormSchema = z.object({
  insumoId: z.string().min(1, 'Selecciona un insumo'),
  tipo: z.enum(TIPOS_MOVIMIENTO),
  origen: z.enum(ORIGENES_MOVIMIENTO),
  cantidad: cantidadField('La cantidad es obligatoria').refine(
    (value) => Number(value) > 0,
    { message: 'La cantidad debe ser mayor a 0' },
  ),
  equipoId: z.string(),
  observacion: z.string().max(240).or(z.literal('')),
});
export type MovimientoFormValues = z.infer<typeof MovimientoFormSchema>;

export interface CreateMovimientoInput {
  insumoId: string;
  tipo: TipoMovimiento;
  origen: OrigenMovimiento;
  cantidad: number;
  equipoId?: string;
  observacion?: string;
}

export function toMovimientoPayload(
  values: MovimientoFormValues,
): CreateMovimientoInput {
  return {
    insumoId: values.insumoId,
    tipo: values.tipo,
    origen: values.origen,
    cantidad: Number(values.cantidad),
    ...(values.equipoId ? { equipoId: values.equipoId } : {}),
    ...(values.observacion.trim() ? { observacion: values.observacion.trim() } : {}),
  };
}

export const AjusteFormSchema = z.object({
  stockContado: cantidadField('Ingresa la cantidad contada'),
  observacion: z.string().max(240).or(z.literal('')),
});
export type AjusteFormValues = z.infer<typeof AjusteFormSchema>;
