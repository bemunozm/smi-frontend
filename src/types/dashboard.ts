import { z } from 'zod';

/**
 * Contrato de datos del dashboard del bloque Núcleo.
 *
 * Terreno (Alexander) ya está integrado a `main` con datos REALES — sus 4
 * piezas (KPI "Hallazgos abiertos", lista de recientes, tendencia semanal,
 * horas extraordinarias por mes) se calculan en cliente desde
 * `hooks/useHallazgos.ts` / `hooks/useTrabajosExtra.ts` vía
 * `config/dashboard-aggregations.ts` — ver `hooks/useDashboard.ts`. Los
 * tipos de acá (`HallazgoResumen`, `HallazgoTendenciaSemana`,
 * `TrabajoExtraordinarioMes`, `HallazgosPorCriticidad`) siguen siendo el
 * contrato de SALIDA que consume `DashboardView`, aunque ya no lleguen por
 * red envueltos en `{ data, message }` (eso lo tipa — sin Zod, son
 * `interface` planas, dominio de Terreno — `types/hallazgos.ts` /
 * `types/trabajosExtra.ts` en la entrada).
 *
 * Flota/Inventario (Amin) y Mantenimiento (Joaquín) siguen sin integrar —
 * `DashboardSummarySchema` de acá y el mock de `api/DashboardAPI.ts` cubren
 * solo esos campos. Cuando expongan sus endpoints reales, el patrón es el
 * mismo: reemplazar el `mockResponse` por `axiosInstance.get(...)`.
 */

export const CRITICIDADES = ['BAJA', 'MEDIA', 'ALTA', 'CRITICA'] as const;
export type Criticidad = (typeof CRITICIDADES)[number];

export const HALLAZGO_ESTADOS = ['ABIERTO', 'EN_PROCESO', 'CERRADO'] as const;
export type HallazgoEstado = (typeof HALLAZGO_ESTADOS)[number];

export const MANTENCION_TIPOS = ['PREVENTIVA', 'CORRECTIVA'] as const;
export type MantencionTipo = (typeof MANTENCION_TIPOS)[number];

export const EQUIPO_ESTADOS = ['DISPONIBLE', 'EN_RUTA', 'EN_MANTENCION', 'DE_BAJA'] as const;
export type EquipoEstado = (typeof EQUIPO_ESTADOS)[number];

/** ← Flota/Inventario (`GET /api/equipos`, contar `estado === 'DISPONIBLE'` / total). */
export const EquiposDisponiblesSchema = z.object({
  disponibles: z.number().int().nonnegative(),
  total: z.number().int().nonnegative(),
});

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
 * KPIs que siguen sin dueño integrado a `main` (Flota/Inventario y
 * Mantenimiento) — únicos campos que todavía sirve `api/DashboardAPI.ts`
 * como mock. `hallazgosAbiertos` e `ingresosTrabajosExtra` salieron de acá:
 * el primero ahora es real (ver `hooks/useDashboard.ts#useHallazgosAbiertosResumen`),
 * el segundo se eliminó — el campo `monto` de `TrabajoExtraordinario` no
 * existe en el modelo real, solo `totalHoras` (cubierto por el gráfico de
 * horas extraordinarias).
 */
export const DashboardSummarySchema = z.object({
  equiposDisponibles: EquiposDisponiblesSchema,
  /** ← Mantenimiento: motor preventivo por umbral de horómetro (Fase 2). */
  proximasMantenciones: z.number().int().nonnegative(),
  /** ← Mantenimiento: % de mantenciones preventivas ejecutadas dentro del
   *  umbral de horómetro (a tiempo) sobre el total programado. Fase 2. */
  cumplimientoPreventivoPct: z.number().min(0).max(100),
  /** ← Inventario/Amin: conteo de insumos con `stockActual < stockMinimo`. */
  insumosBajoMinimo: z.number().int().nonnegative(),
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

/** ← Mantenimiento: motor preventivo, próximos equipos a umbral (Fase 2). */
export const MantencionProximaSchema = z.object({
  id: z.string(),
  equipo: z.string(),
  tipo: z.enum(MANTENCION_TIPOS),
  /** Horas de horómetro restantes hasta el umbral. 0 = ya alcanzado/vencido. */
  horometroRestante: z.number().nonnegative(),
});
export type MantencionProxima = z.infer<typeof MantencionProximaSchema>;

/** ← Flota/Inventario (Amin): conteo de `Equipo.estado` agrupado. Alimenta el
 * gráfico de composición de flota — aporta la MEZCLA de estados que la card
 * "Equipos disponibles" (disponibles/total) no muestra. Endpoint no existe
 * aún; hoy se contaría en cliente sobre `GET /api/equipos`. */
export const FlotaComposicionItemSchema = z.object({
  estado: z.enum(EQUIPO_ESTADOS),
  cantidad: z.number().int().nonnegative(),
});
export type FlotaComposicionItem = z.infer<typeof FlotaComposicionItemSchema>;

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

/** ← Inventario/Amin: insumos con `stockActual < stockMinimo`. Alimenta el
 * KPI `insumosBajoMinimo` (mismo endpoint) y la tabla del mismo nombre. */
export const InsumoBajoStockSchema = z.object({
  id: z.string(),
  insumo: z.string(),
  stockActual: z.number().nonnegative(),
  stockMinimo: z.number().nonnegative(),
});
export type InsumoBajoStock = z.infer<typeof InsumoBajoStockSchema>;

/** Envolturas `{ data, message }` — mismo formato que ya usa `smi-backend`
 * en `users` (ver `types/user.ts`); el mock las respeta para que activar el
 * fetch real el día de mañana sea un cambio de una línea en `DashboardAPI`.
 * Solo quedan las de los dominios que TODAVÍA son mock (Mantenimiento,
 * Flota/Inventario) — las de Terreno se retiraron: ese dominio no valida con
 * Zod (interfaces planas en `types/hallazgos.ts` / `types/trabajosExtra.ts`,
 * deuda propia de Terreno, fuera del alcance de Núcleo) y deriva el shape de
 * salida en cliente. */
export const DashboardSummaryResponseSchema = z.object({
  data: DashboardSummarySchema,
  message: z.string(),
});

export const MantencionesProximasResponseSchema = z.object({
  data: z.array(MantencionProximaSchema),
  message: z.string(),
});

export const FlotaComposicionResponseSchema = z.object({
  data: z.array(FlotaComposicionItemSchema),
  message: z.string(),
});

export const InsumosBajoStockResponseSchema = z.object({
  data: z.array(InsumoBajoStockSchema),
  message: z.string(),
});
