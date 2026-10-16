import { z } from 'zod';

/**
 * Contrato de datos del dashboard del bloque Núcleo.
 *
 * Terreno, Flota e Inventario ya están integrados con datos REALES. Terreno: sus 4 piezas (KPI "Hallazgos abiertos",
 * lista de recientes, tendencia semanal, horas extraordinarias por mes) se
 * calculan en cliente desde `hooks/useHallazgos.ts` / `hooks/useTrabajosExtra.ts`
 * vía `config/dashboard-aggregations.ts` — ver `hooks/useDashboard.ts`. Los
 * tipos de acá (`HallazgoResumen`, `HallazgoTendenciaSemana`,
 * `TrabajoExtraordinarioMes`, `HallazgosPorCriticidad`) siguen siendo el
 * contrato de SALIDA que consume `DashboardView`, aunque ya no lleguen por
 * red envueltos en `{ data, message }` (eso lo tipa — sin Zod, son
 * `interface` planas, dominio de Terreno — `types/hallazgos.ts` /
 * `types/trabajosExtra.ts` en la entrada).
 *
 * Flota/Inventario NO se lee desde acá: `DashboardView` consume
 * directo `useResumenFleet()`/`useInsumos()` de `hooks/useEquipment.ts` /
 * `hooks/useInventario.ts` y sus tipos (`ResumenFleet`, `Insumo`) de
 * `types/equipment.ts` / `types/inventario.ts` — sin capa de agregación propia
 * (el backend ya agrega `disponibles`/`total`/`porEstado`/`bajoMinimo`).
 *
 * Mantenimiento sigue sin integrar (el motor preventivo por umbral de
 * horómetro no existe aún) — `DashboardSummarySchema` de acá y el
 * mock de `api/DashboardAPI.ts` cubren solo esos 2 campos. Cuando exponga su
 * endpoint real, el patrón es el mismo: reemplazar el `mockResponse` por
 * `axiosInstance.get(...)`.
 */

export const CRITICIDADES = ['BAJA', 'MEDIA', 'ALTA', 'CRITICA'] as const;
export type Criticidad = (typeof CRITICIDADES)[number];

export const HALLAZGO_ESTADOS = ['ABIERTO', 'EN_PROCESO', 'CERRADO'] as const;
export type HallazgoEstado = (typeof HALLAZGO_ESTADOS)[number];

export const MANTENCION_TIPOS = ['PREVENTIVA', 'CORRECTIVA'] as const;

/** Breakdown por prioridad de los hallazgos con `estado === 'ABIERTO'` —
 * complementa la card "Hallazgos abiertos" (mismo listado que ese KPI,
 * agrupado por `prioridad`). Calculado en cliente en
 * `config/dashboard-aggregations.ts#hallazgosAbiertosPorPrioridad` desde el
 * listado real de `hooks/useHallazgos.ts` — ya no es parte de
 * `DashboardSummarySchema` (no llega envuelto en `{ data, message }`, se
 * deriva). El nombre del campo sigue siendo "criticidad" del lado del
 * dashboard aunque el backend lo llame `prioridad` (ver `types/hallazgos.ts`). */
export const HallazgosPorCriticidadSchema = z.object({
  critica: z.number().int().nonnegative(),
  alta: z.number().int().nonnegative(),
  media: z.number().int().nonnegative(),
  baja: z.number().int().nonnegative(),
});
export type HallazgosPorCriticidad = z.infer<typeof HallazgosPorCriticidadSchema>;

/**
 * KPIs que siguen sin backend (Mantenimiento: motor preventivo) —
 * únicos campos que todavía sirve `api/DashboardAPI.ts` como mock.
 * `equiposDisponibles`/`insumosBajoMinimo` salieron de acá (ahora reales, ver
 * `hooks/useEquipment.ts#useResumenFleet` / `hooks/useInventario.ts#useResumenInventario`),
 * igual que `hallazgosAbiertos` (real) e `ingresosTrabajosExtra` (eliminado —
 * el campo `monto` de `TrabajoExtraordinario` no existe en el modelo real,
 * solo `totalHoras`, cubierto por el gráfico de horas extraordinarias).
 */
// TODO(Task 6-8): eliminar — schema del mock (la vista nueva usa ResumenHoySchema & co.)
export const DashboardSummarySchema = z.object({
  /** ← Mantenimiento: motor preventivo por umbral de horómetro. */
  proximasMantenciones: z.number().int().nonnegative(),
  /** ← Mantenimiento: % de mantenciones preventivas ejecutadas dentro del
   *  umbral de horómetro (a tiempo) sobre el total programado. */
  cumplimientoPreventivoPct: z.number().min(0).max(100),
});
export type DashboardSummary = z.infer<typeof DashboardSummarySchema>;

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

/** ← Mantenimiento: motor preventivo, próximos equipos a umbral. */
// TODO(Task 6-8): eliminar — schema del mock de próximas mantenciones
export const MantencionProximaSchema = z.object({
  id: z.string(),
  equipo: z.string(),
  tipo: z.enum(MANTENCION_TIPOS),
  /** Horas de horómetro restantes hasta el umbral. 0 = ya alcanzado/vencido. */
  horometroRestante: z.number().nonnegative(),
});
export type MantencionProxima = z.infer<typeof MantencionProximaSchema>;

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

/** ← Terreno (real): horas máquina de `TrabajoExtraordinario.totalHoras`/`fecha`,
 * agrupadas por mes (~6 meses) en cliente —
 * `config/dashboard-aggregations.ts#trabajosExtraPorMes`. Usa HORAS, no
 * ingresos: el campo `monto` no existe en el modelo real (solo
 * `totalHoras`), así que el KPI de ingresos que tenía el mock se eliminó. */
export const TrabajoExtraordinarioMesSchema = z.object({
  mes: z.string(),
  horas: z.number().nonnegative(),
});
export type TrabajoExtraordinarioMes = z.infer<typeof TrabajoExtraordinarioMesSchema>;

/** Envolturas `{ data, message }` — mismo formato que ya usa `smi-backend`
 * en `users` (ver `types/user.ts`); el mock las respeta para que activar el
 * fetch real el día de mañana sea un cambio de una línea en `DashboardAPI`.
 * Solo queda la del dominio que TODAVÍA es mock (Mantenimiento) — las de
 * Terreno se retiraron: ese dominio no valida con Zod (interfaces planas en
 * `types/hallazgos.ts` / `types/trabajosExtra.ts`, deuda propia de Terreno,
 * fuera del alcance de Núcleo) y deriva el shape de salida en cliente;
 * Flota/Inventario tampoco tiene envoltura acá — usa directo las respuestas
 * ya validadas por `types/equipo.ts` / `types/inventario.ts`. */
// TODO(Task 6-8): eliminar — envoltura del mock
export const DashboardSummaryResponseSchema = z.object({
  data: DashboardSummarySchema,
  message: z.string(),
});

// TODO(Task 6-8): eliminar — envoltura del mock
export const MantencionesProximasResponseSchema = z.object({
  data: z.array(MantencionProximaSchema),
  message: z.string(),
});

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
