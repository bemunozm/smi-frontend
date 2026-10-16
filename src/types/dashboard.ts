import { z } from 'zod';

/**
 * Contrato de datos del dashboard del administrador.
 *
 * Dos grupos, ambos de datos reales:
 * - Hallazgos (Terreno): `HallazgoResumen`, `HallazgoTendenciaSemana` y
 *   `HallazgosPorCriticidad` son el shape de SALIDA que la vista consume; se
 *   derivan en cliente desde `hooks/useHallazgos.ts` vía
 *   `config/dashboard-aggregations.ts` (ver `hooks/useDashboard.ts`).
 * - Métricas del administrador (al final): replican la respuesta de
 *   `/api/dashboard/*` de smi-backend y se validan con Zod en `api/DashboardAPI.ts`.
 */

export const CRITICIDADES = ['BAJA', 'MEDIA', 'ALTA', 'CRITICA'] as const;
export type Criticidad = (typeof CRITICIDADES)[number];

export const HALLAZGO_ESTADOS = ['ABIERTO', 'EN_PROCESO', 'CERRADO'] as const;
export type HallazgoEstado = (typeof HALLAZGO_ESTADOS)[number];

/** Breakdown por prioridad de los hallazgos con `estado === 'ABIERTO'` —
 * complementa la card "Hallazgos abiertos" (mismo listado que ese KPI,
 * agrupado por `prioridad`). Calculado en cliente en
 * `config/dashboard-aggregations.ts#hallazgosAbiertosPorPrioridad` desde el
 * listado real de `hooks/useHallazgos.ts` — se deriva en cliente, no llega por red.
 * El campo sigue llamándose "criticidad" del lado del dashboard aunque el backend lo llame `prioridad` (ver `types/hallazgos.ts`). */
export const HallazgosPorCriticidadSchema = z.object({
  critica: z.number().int().nonnegative(),
  alta: z.number().int().nonnegative(),
  media: z.number().int().nonnegative(),
  baja: z.number().int().nonnegative(),
});
export type HallazgosPorCriticidad = z.infer<typeof HallazgosPorCriticidadSchema>;

/** ← Terreno (real): top 5 del listado de `GET /api/hallazgos` (ya viene
 * `orderBy fecha desc`), remapeado en cliente desde `Hallazgo` —
 * `config/dashboard-aggregations.ts#hallazgosRecientes`. Ya no valida una
 * respuesta de red directamente (por eso no tiene `*ResponseSchema`), pero
 * se mantiene como tipo de SALIDA porque `DashboardView` sigue consumiendo
 * este shape. */
export const HallazgoResumenSchema = z.object({
  id: z.string(),
  equipo: z.string(),
  descripcion: z.string(),
  criticidad: z.enum(CRITICIDADES),
  estado: z.enum(HALLAZGO_ESTADOS),
  fecha: z.string().datetime(),
});
export type HallazgoResumen = z.infer<typeof HallazgoResumenSchema>;

/** ← Terreno (real): tendencia semanal de `Hallazgo.estado`/`fecha`, abiertos
 * vs cerrados (~8 semanas). Calculada en cliente —
 * `config/dashboard-aggregations.ts#hallazgosTendenciaSemanal` — documenta
 * ahí la semántica exacta (agrupa por semana de REPORTE, no de cierre; el
 * modelo no tiene fecha de cierre). */
export const HallazgoTendenciaSemanaSchema = z.object({
  semana: z.string(),
  abiertos: z.number().int().nonnegative(),
  cerrados: z.number().int().nonnegative(),
});
export type HallazgoTendenciaSemana = z.infer<typeof HallazgoTendenciaSemanaSchema>;

// ---------------------------------------------------------------------------
// Contrato real del dashboard administrador (endpoints de smi-backend).
// Los campos replican exactamente la respuesta de cada endpoint.
// ---------------------------------------------------------------------------

export const EstadoEquipoHoySchema = z.object({
  equipmentId: z.string(),
  internalCode: z.string(),
  estado: z.enum(['EN_USO', 'DISPONIBLE', 'INOPERATIVO']),
  operador: z.string().optional(),
  turno: z.string().optional(),
  supervisor: z.string().optional(),
});

export const ResumenHoySchema = z.object({
  totales: z.object({
    enUso: z.number().int(),
    disponibles: z.number().int(),
    inoperativos: z.number().int(),
  }),
  equipos: z.array(EstadoEquipoHoySchema),
});
export type ResumenHoy = z.infer<typeof ResumenHoySchema>;

export const MetricasEquipoSchema = z.object({
  equipmentId: z.string(),
  internalCode: z.string(),
  horas: z.number(),
  litros: z.number(),
  rendimiento: z.number().nullable(),
  serieDiaria: z.array(
    z.object({ fecha: z.string(), horas: z.number(), opero: z.boolean() }),
  ),
});
export type MetricasEquipo = z.infer<typeof MetricasEquipoSchema>;

export const SupervisoresSchema = z.object({
  porTurno: z.record(
    z.enum(['DIURNO', 'NOCTURNO']),
    z.object({ horas: z.number(), equipos: z.number() }),
  ),
  porSupervisor: z.array(
    z.object({
      supervisorId: z.string(),
      nombre: z.string(),
      horas: z.number(),
      equipos: z.number(),
      turnos: z.number(),
    }),
  ),
});
export type Supervisores = z.infer<typeof SupervisoresSchema>;

export const MantenedoresSchema = z.object({
  total: z.object({ horas: z.number(), trabajos: z.number() }),
  porEquipo: z.array(
    z.object({
      equipmentId: z.string(),
      internalCode: z.string(),
      horas: z.number(),
      trabajos: z.number(),
    }),
  ),
});
export type Mantenedores = z.infer<typeof MantenedoresSchema>;

export const VueltasSchema = z.object({
  porSeccion: z.array(
    z.object({
      seccion: z.enum(['INTERNOS', 'MINA_CALETA', 'MINERAS']),
      camiones: z.number().int(),
      vueltasTotales: z.number().int(),
      serieDiaria: z.array(z.object({ fecha: z.string(), vueltas: z.number().int() })),
    }),
  ),
});
export type Vueltas = z.infer<typeof VueltasSchema>;

export interface RangoDashboard {
  desde: string; // YYYY-MM-DD
  hasta: string;
}
