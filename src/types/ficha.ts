import { z } from 'zod';

import { EQUIPMENT_STATUS } from './equipment';

/**
 * Contrato de `GET /api/equipos/:id/ficha` — vista consolidada del equipo:
 * datos técnicos, contadores por dominio y una línea de tiempo unificada de
 * eventos (ya viene ordenada por fecha desc desde el backend).
 */
export const EVENTO_TIPOS = [
  'COMBUSTIBLE',
  'HOROMETRO',
  'TRABAJO_EXTRA',
  'HALLAZGO',
  'ORDEN_TRABAJO',
  'INTERVENCION',
  'ACTIVIDAD',
] as const;
export type EventoFichaTipo = (typeof EVENTO_TIPOS)[number];

/**
 * `meta` varía según `tipo` (distintas claves para HALLAZGO, HOROMETRO,
 * etc.) — se modela como record flexible en vez de una unión discriminada:
 * la timeline es de solo lectura y no necesita distinguir el shape en el
 * tipo, solo en el render (Fase 3).
 */
export const EventoFichaSchema = z.object({
  id: z.string(),
  tipo: z.enum(EVENTO_TIPOS),
  fecha: z.string(),
  titulo: z.string(),
  detalle: z.string(),
  meta: z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()])),
});
export type EventoFicha = z.infer<typeof EventoFichaSchema>;

/**
 * Datos técnicos del equipo dentro de la ficha (subset de `Equipment`, ver
 * `types/equipment.ts`). Identificadores en inglés — mismo contrato que
 * expone `GET /api/equipment/:id/ficha`.
 */
export const FichaTecnicaSchema = z.object({
  id: z.string(),
  internalCode: z.string(),
  type: z.string(),
  brand: z.string(),
  model: z.string(),
  year: z.number().int().nullable(),
  status: z.enum(EQUIPMENT_STATUS),
  currentHourmeter: z.number().nullable(),
  currentMileage: z.number().nullable(),
});
export type FichaTecnica = z.infer<typeof FichaTecnicaSchema>;

/** Contadores agregados que alimentan las tarjetas de resumen de la ficha. */
export const ResumenFichaSchema = z.object({
  combustibles: z.number(),
  horometros: z.number(),
  trabajosExtra: z.number(),
  hallazgos: z.number(),
  hallazgosAbiertos: z.number(),
  ordenes: z.number(),
  ordenesAbiertas: z.number(),
  actividades: z.number(),
});
export type ResumenFicha = z.infer<typeof ResumenFichaSchema>;

export const FichaEquipoSchema = z.object({
  equipo: FichaTecnicaSchema,
  resumen: ResumenFichaSchema,
  timeline: z.array(EventoFichaSchema),
});
export type FichaEquipo = z.infer<typeof FichaEquipoSchema>;

export const FichaResponseSchema = z.object({
  data: FichaEquipoSchema,
  message: z.string(),
});
