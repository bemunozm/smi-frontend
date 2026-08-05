import { z } from 'zod';

/**
 * Schemas Zod del dominio Mantenimiento — espejo del contrato real de
 * `smi-backend` (endpoints `/api/mantenimiento/*`, en construcción en
 * paralelo). Sigue el mismo patrón que `types/user.ts`: enums con `z.enum`,
 * entidades, envolturas `{ data, message }` de lista/detalle, y schemas de
 * input para los forms (RHF + `zodResolver`).
 */

// ---------------------------------------------------------------------------
// Enums — mismo patrón que `types/roles.ts` (objeto + type derivado) en vez
// de strings mágicos repetidos en cada schema/select.
// ---------------------------------------------------------------------------

export const ESTADO_OT = {
  PENDIENTE: 'PENDIENTE',
  ASIGNADA: 'ASIGNADA',
  EN_PROCESO: 'EN_PROCESO',
  COMPLETADA: 'COMPLETADA',
  CANCELADA: 'CANCELADA',
} as const;
export type EstadoOT = (typeof ESTADO_OT)[keyof typeof ESTADO_OT];
export const ESTADOS_OT: readonly EstadoOT[] = Object.values(ESTADO_OT);

export const TIPO_OT = {
  CORRECTIVA: 'CORRECTIVA',
  PREVENTIVA: 'PREVENTIVA',
} as const;
export type TipoOT = (typeof TIPO_OT)[keyof typeof TIPO_OT];
export const TIPOS_OT: readonly TipoOT[] = Object.values(TIPO_OT);

export const ORIGEN_OT = {
  MANUAL: 'MANUAL',
  PREVENTIVO: 'PREVENTIVO',
  HALLAZGO: 'HALLAZGO',
} as const;
export type OrigenOT = (typeof ORIGEN_OT)[keyof typeof ORIGEN_OT];
export const ORIGENES_OT: readonly OrigenOT[] = Object.values(ORIGEN_OT);

export const PRIORIDAD_OT = {
  BAJA: 'BAJA',
  MEDIA: 'MEDIA',
  ALTA: 'ALTA',
  CRITICA: 'CRITICA',
} as const;
export type PrioridadOT = (typeof PRIORIDAD_OT)[keyof typeof PRIORIDAD_OT];
export const PRIORIDADES_OT: readonly PrioridadOT[] = Object.values(PRIORIDAD_OT);

export const ESTADO_ACTIVIDAD = {
  PENDIENTE: 'PENDIENTE',
  COMPLETADA: 'COMPLETADA',
} as const;
export type EstadoActividad = (typeof ESTADO_ACTIVIDAD)[keyof typeof ESTADO_ACTIVIDAD];
export const ESTADOS_ACTIVIDAD: readonly EstadoActividad[] = Object.values(ESTADO_ACTIVIDAD);

export const ORIGEN_ACTIVIDAD = {
  HALLAZGO: 'HALLAZGO',
  EQUIPO: 'EQUIPO',
  MANUAL: 'MANUAL',
} as const;
export type OrigenActividad = (typeof ORIGEN_ACTIVIDAD)[keyof typeof ORIGEN_ACTIVIDAD];
export const ORIGENES_ACTIVIDAD: readonly OrigenActividad[] = Object.values(ORIGEN_ACTIVIDAD);

// ---------------------------------------------------------------------------
// Entidades compartidas
// ---------------------------------------------------------------------------

/** Persona asignada — subset de `User` que exponen los endpoints de Mantenimiento. */
export const AsignadoSchema = z.object({
  id: z.string(),
  nombre: z.string(),
});
export type Asignado = z.infer<typeof AsignadoSchema>;

// ---------------------------------------------------------------------------
// Orden de trabajo (OT)
// ---------------------------------------------------------------------------

export const TareaSchema = z.object({
  id: z.string(),
  texto: z.string(),
  hecha: z.boolean(),
  posicion: z.number(),
});
export type Tarea = z.infer<typeof TareaSchema>;

export const OrdenTrabajoSchema = z.object({
  id: z.string(),
  equipoId: z.string(),
  titulo: z.string(),
  estado: z.enum(ESTADO_OT),
  prioridad: z.enum(PRIORIDAD_OT),
  tipo: z.enum(TIPO_OT),
  origen: z.enum(ORIGEN_OT),
  origenDetalle: z.string().nullable(),
  asignadoA: AsignadoSchema.nullable(),
  tareas: z.array(TareaSchema),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type OrdenTrabajo = z.infer<typeof OrdenTrabajoSchema>;

/** Envoltura `{ data, message }` — todas las respuestas del backend la usan. */
export const OrdenTrabajoListResponseSchema = z.object({
  data: z.array(OrdenTrabajoSchema),
  message: z.string(),
});

export const OrdenTrabajoResponseSchema = z.object({
  data: OrdenTrabajoSchema,
  message: z.string(),
});

/**
 * `PATCH /ordenes/:ordenId/tareas/:tareaId` → `{ data: Tarea, message }`.
 * El backend devuelve SOLO la tarea actualizada (no la OT completa); igual
 * `useToggleTarea` invalida `['ordenes']`, que es la fuente de verdad.
 */
export const TareaResponseSchema = z.object({
  data: TareaSchema,
  message: z.string(),
});

/**
 * `POST /api/mantenimiento/ordenes` body (ADMIN/SUPERVISOR). `equipoId` y
 * `asignadoAId` son texto libre a propósito: Flota (selector de equipo) e
 * Inventario/Usuarios (selector de asignado) no exponen todavía un endpoint
 * consumible acá — ver TODOs en `OrdenesTrabajoView`.
 */
export const CreateOrdenSchema = z.object({
  equipoId: z.string().min(1, 'El equipo es obligatorio'),
  titulo: z.string().min(1, 'El título es obligatorio'),
  prioridad: z.enum(PRIORIDAD_OT),
  tipo: z.enum(TIPO_OT),
  origen: z.enum(ORIGEN_OT),
  origenDetalle: z.string().optional(),
  asignadoAId: z.string().optional(),
});
export type CreateOrdenInput = z.infer<typeof CreateOrdenSchema>;

/** `PATCH /api/mantenimiento/ordenes/:id` body — parcial, el form solo cambia `estado`. */
export const UpdateOrdenSchema = z.object({
  estado: z.enum(ESTADO_OT).optional(),
  asignadoAId: z.string().optional(),
  prioridad: z.enum(PRIORIDAD_OT).optional(),
  titulo: z.string().optional(),
});
export type UpdateOrdenInput = z.infer<typeof UpdateOrdenSchema>;

/** `PATCH /api/mantenimiento/ordenes/:ordenId/tareas/:tareaId` body. */
export const ToggleTareaSchema = z.object({
  hecha: z.boolean(),
});
export type ToggleTareaInput = z.infer<typeof ToggleTareaSchema>;

// ---------------------------------------------------------------------------
// Intervención (bitácora de una OT)
// ---------------------------------------------------------------------------

/**
 * Insumo consumido en una intervención. El backend todavía NO decrementa
 * stock ni devuelve el stock del insumo acá (solo `insumoId` + `cantidad`) —
 * la UI muestra la cantidad y marca el stock como "pendiente de Inventario",
 * nunca simula un stock antes/después.
 */
export const InsumoUsadoSchema = z.object({
  id: z.string(),
  insumoId: z.string(),
  cantidad: z.number(),
});
export type InsumoUsado = z.infer<typeof InsumoUsadoSchema>;

export const IntervencionSchema = z.object({
  id: z.string(),
  ordenId: z.string(),
  tipo: z.enum(TIPO_OT),
  detalle: z.string(),
  horasHombre: z.number(),
  horometro: z.number().nullable(),
  soloLectura: z.boolean(),
  insumos: z.array(InsumoUsadoSchema),
  fecha: z.string(),
});
export type Intervencion = z.infer<typeof IntervencionSchema>;

export const IntervencionListResponseSchema = z.object({
  data: z.array(IntervencionSchema),
  message: z.string(),
});

export const IntervencionResponseSchema = z.object({
  data: IntervencionSchema,
  message: z.string(),
});

/**
 * `POST /api/mantenimiento/ordenes/:id/intervenciones` body (MANTENEDOR).
 * `insumoId` es texto libre — Inventario no expone todavía un selector de
 * insumos consumible acá (ver TODO en `BitacoraView`).
 */
export const CreateIntervencionInsumoSchema = z.object({
  insumoId: z.string().min(1, 'El insumo es obligatorio'),
  cantidad: z.number().min(0.01, 'La cantidad debe ser mayor a 0'),
});
export type CreateIntervencionInsumoInput = z.infer<typeof CreateIntervencionInsumoSchema>;

export const CreateIntervencionSchema = z.object({
  tipo: z.enum(TIPO_OT),
  detalle: z.string().min(1, 'El detalle es obligatorio'),
  horasHombre: z.number().min(0, 'Debe ser 0 o mayor'),
  horometro: z.number().min(0, 'Debe ser 0 o mayor').optional(),
  insumos: z.array(CreateIntervencionInsumoSchema).optional(),
});
export type CreateIntervencionInput = z.infer<typeof CreateIntervencionSchema>;

// ---------------------------------------------------------------------------
// Umbral preventivo
// ---------------------------------------------------------------------------

export const UmbralSchema = z.object({
  id: z.string(),
  tipoEquipo: z.string(),
  tipoMantencion: z.string(),
  umbralHoras: z.number(),
});
export type Umbral = z.infer<typeof UmbralSchema>;

export const UmbralListResponseSchema = z.object({
  data: z.array(UmbralSchema),
  message: z.string(),
});

export const UmbralResponseSchema = z.object({
  data: UmbralSchema,
  message: z.string(),
});

/** `POST /api/mantenimiento/umbrales` body (ADMIN). */
export const CreateUmbralSchema = z.object({
  tipoEquipo: z.string().min(1, 'El tipo de equipo es obligatorio'),
  tipoMantencion: z.string().min(1, 'El tipo de mantención es obligatorio'),
  umbralHoras: z.number().min(1, 'El umbral debe ser mayor a 0'),
});
export type CreateUmbralInput = z.infer<typeof CreateUmbralSchema>;

// ---------------------------------------------------------------------------
// Actividad (tarea asignada fuera de una OT)
// ---------------------------------------------------------------------------

export const ActividadSchema = z.object({
  id: z.string(),
  descripcion: z.string(),
  origen: z.enum(ORIGEN_ACTIVIDAD),
  referencia: z.string().nullable(),
  asignadoA: AsignadoSchema.nullable(),
  equipoId: z.string().nullable(),
  hallazgoId: z.string().nullable(),
  estado: z.enum(ESTADO_ACTIVIDAD),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Actividad = z.infer<typeof ActividadSchema>;

export const ActividadListResponseSchema = z.object({
  data: z.array(ActividadSchema),
  message: z.string(),
});

export const ActividadResponseSchema = z.object({
  data: ActividadSchema,
  message: z.string(),
});

/**
 * `POST /api/mantenimiento/actividades` body (ADMIN/SUPERVISOR). `equipoId`/
 * `hallazgoId` quedan como texto libre (Flota/Hallazgos aún no exponen un
 * selector real) y `asignadoAId` también, ver TODOs en `ActividadesView`.
 */
export const CreateActividadSchema = z.object({
  descripcion: z.string().min(1, 'La descripción es obligatoria'),
  origen: z.enum(ORIGEN_ACTIVIDAD),
  referencia: z.string().optional(),
  asignadoAId: z.string().optional(),
  equipoId: z.string().optional(),
  hallazgoId: z.string().optional(),
});
export type CreateActividadInput = z.infer<typeof CreateActividadSchema>;

/** `PATCH /api/mantenimiento/actividades/:id` body. */
export const UpdateActividadSchema = z.object({
  estado: z.enum(ESTADO_ACTIVIDAD),
});
export type UpdateActividadInput = z.infer<typeof UpdateActividadSchema>;
