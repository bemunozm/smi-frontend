import { z } from 'zod';

import { ESTADOS_EQUIPO } from './equipo';
import { TIPOS_INSUMO, UNIDADES_INSUMO } from './inventario';

/**
 * Contrato de compatibilidad repuesto ↔ equipo (RFC-12).
 *
 * La consulta principal (`/api/equipos/:id/repuestos`) devuelve el repuesto
 * **con su stock**: saber que algo "sirve" sin saber si "lo tengo" no cambia
 * ninguna decisión.
 */
export const RepuestoCompatibleSchema = z.object({
  compatibilidadId: z.string(),
  insumoId: z.string(),
  codigo: z.string(),
  nombre: z.string(),
  descripcion: z.string().nullable(),
  unidad: z.enum(UNIDADES_INSUMO),
  tipo: z.enum(TIPOS_INSUMO),
  /** Salvedad declarada: "solo desde nº serie 4500", "requiere adaptador". */
  nota: z.string().nullable(),
  stockSucursal: z.number(),
  stockTotal: z.number(),
  stockMinimo: z.number(),
  bajoMinimo: z.boolean(),
});
export type RepuestoCompatible = z.infer<typeof RepuestoCompatibleSchema>;

export const RepuestosDeEquipoSchema = z.object({
  equipo: z.object({
    id: z.string(),
    codigo: z.string(),
    tipo: z.string(),
    marca: z.string(),
    modelo: z.string(),
    estado: z.enum(ESTADOS_EQUIPO),
  }),
  sucursalId: z.string(),
  repuestos: z.array(RepuestoCompatibleSchema),
});
export type RepuestosDeEquipo = z.infer<typeof RepuestosDeEquipoSchema>;

/** Dirección inversa: en qué equipos se usa un repuesto. */
export const EquipoCompatibleSchema = z.object({
  compatibilidadId: z.string(),
  equipoId: z.string(),
  codigo: z.string(),
  tipo: z.string(),
  marca: z.string(),
  modelo: z.string(),
  estado: z.enum(ESTADOS_EQUIPO),
  nota: z.string().nullable(),
});
export type EquipoCompatible = z.infer<typeof EquipoCompatibleSchema>;

/** Equipo del mismo marca+modelo desde el cual copiar las compatibilidades. */
export const OrigenReplicableSchema = z.object({
  equipoId: z.string(),
  codigo: z.string(),
  cantidad: z.number().int().nonnegative(),
});
export type OrigenReplicable = z.infer<typeof OrigenReplicableSchema>;

export const ResultadoReplicacionSchema = z.object({
  copiadas: z.number().int().nonnegative(),
  omitidas: z.number().int().nonnegative(),
});
export type ResultadoReplicacion = z.infer<typeof ResultadoReplicacionSchema>;

// --- Envolturas `{ data, message }` ---------------------------------------

export const RepuestosDeEquipoResponseSchema = z.object({
  data: RepuestosDeEquipoSchema,
  message: z.string(),
});

export const EquiposCompatiblesResponseSchema = z.object({
  data: z.array(EquipoCompatibleSchema),
  message: z.string(),
});

export const OrigenesReplicablesResponseSchema = z.object({
  data: z.array(OrigenReplicableSchema),
  message: z.string(),
});

export const CompatibilidadResponseSchema = z.object({
  data: z.object({
    id: z.string(),
    equipoId: z.string(),
    insumoId: z.string(),
    nota: z.string().nullable(),
  }),
  message: z.string(),
});

export const ReplicacionResponseSchema = z.object({
  data: ResultadoReplicacionSchema,
  message: z.string(),
});

export const DeleteCompatibilidadResponseSchema = z.object({
  data: z.object({ id: z.string() }).nullable(),
  message: z.string(),
});

// --- Entradas --------------------------------------------------------------

export interface CreateCompatibilidadInput {
  equipoId: string;
  insumoId: string;
  nota?: string;
}

// --- Formularios -----------------------------------------------------------

export const CompatibilidadFormSchema = z.object({
  insumoId: z.string().min(1, 'Selecciona un repuesto'),
  nota: z.string().max(240).or(z.literal('')),
});
export type CompatibilidadFormValues = z.infer<
  typeof CompatibilidadFormSchema
>;

export function toCompatibilidadPayload(
  equipoId: string,
  values: CompatibilidadFormValues,
): CreateCompatibilidadInput {
  return {
    equipoId,
    insumoId: values.insumoId,
    // Se omite en vez de mandar `''`: el backend corre con
    // `forbidNonWhitelisted` y un string vacío solo deja basura en la base.
    ...(values.nota.trim() ? { nota: values.nota.trim() } : {}),
  };
}

// La lectura "¿dónde está lo que necesito?" vive en `types/disponibilidad.ts`,
// compartida con la pantalla de stock por sucursal: es la misma pregunta sobre
// la misma fila y no puede contestarse distinto según la pantalla.
