import { z } from 'zod';

/**
 * Contrato de datos del dashboard del bloque Núcleo. Los dominios que lo
 * alimentan (Terreno, Mantenimiento, Flota/Inventario) todavía no están
 * integrados a `main` — este archivo ES el contrato: cuando esos dominios
 * expongan sus endpoints reales, `api/DashboardAPI.ts` deja de construir
 * mocks y pasa a `axiosInstance.get(...)`, pero la forma de los datos que
 * consume la vista no cambia (siempre que el backend respete este shape).
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

/** Breakdown por criticidad de los hallazgos con `estado === 'ABIERTO'` —
 * complementa la card "Hallazgos abiertos" (mismo endpoint que ese KPI,
 * agrupado por `criticidad` en vez de solo contar). */
export const HallazgosPorCriticidadSchema = z.object({
  critica: z.number().int().nonnegative(),
  alta: z.number().int().nonnegative(),
  media: z.number().int().nonnegative(),
  baja: z.number().int().nonnegative(),
});
export type HallazgosPorCriticidad = z.infer<typeof HallazgosPorCriticidadSchema>;

export const DashboardSummarySchema = z.object({
  equiposDisponibles: EquiposDisponiblesSchema,
  /** ← Terreno: `GET /api/hallazgos?estado=ABIERTO`, contar `data.length`. */
  hallazgosAbiertos: z.number().int().nonnegative(),
  /** ← Terreno: mismo listado de arriba, agrupado por `criticidad`. */
  hallazgosAbiertosPorCriticidad: HallazgosPorCriticidadSchema,
  /** ← Mantenimiento: motor preventivo por umbral de horómetro (Fase 2). */
  proximasMantenciones: z.number().int().nonnegative(),
  /** ← Terreno: suma de `monto` en `TrabajoExtraordinario`. CLP. Sujeto a
   *  confirmación — el campo `monto` fue eliminado del modelo, pendiente
   *  reponerlo con Alexander. */
  ingresosTrabajosExtra: z.number().nonnegative(),
  /** ← Mantenimiento: % de mantenciones preventivas ejecutadas dentro del
   *  umbral de horómetro (a tiempo) sobre el total programado. Fase 2. */
  cumplimientoPreventivoPct: z.number().min(0).max(100),
  /** ← Inventario/Amin: conteo de insumos con `stockActual < stockMinimo`. */
  insumosBajoMinimo: z.number().int().nonnegative(),
});
export type DashboardSummary = z.infer<typeof DashboardSummarySchema>;

/** ← Terreno: `GET /api/hallazgos?estado=ABIERTO&limit=5`, orden por fecha desc. */
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

/** ← Terreno: tendencia semanal de `Hallazgo.estado`/`fecha`, abiertos vs
 * cerrados (~8 semanas). Aporta la dimensión TEMPORAL (¿se acumulan o se
 * resuelven?) que ninguna card muestra. Depende de agregación por semana que
 * el endpoint actual de hallazgos no soporta — habría que pedirla o agregar
 * en cliente sobre el listado completo mientras tanto. */
export const HallazgoTendenciaSemanaSchema = z.object({
  semana: z.string(),
  abiertos: z.number().int().nonnegative(),
  cerrados: z.number().int().nonnegative(),
});
export type HallazgoTendenciaSemana = z.infer<typeof HallazgoTendenciaSemanaSchema>;

/** ← Terreno: horas máquina de `TrabajoExtraordinario.totalHoras`/`fecha`,
 * agrupadas por mes (~6 meses). Usa HORAS, no ingresos — el campo `monto`
 * fue eliminado del modelo (ver `ingresosTrabajosExtra` en el summary). */
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
 * fetch real el día de mañana sea un cambio de una línea en `DashboardAPI`. */
export const DashboardSummaryResponseSchema = z.object({
  data: DashboardSummarySchema,
  message: z.string(),
});

export const HallazgosRecientesResponseSchema = z.object({
  data: z.array(HallazgoResumenSchema),
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

export const HallazgosTendenciaResponseSchema = z.object({
  data: z.array(HallazgoTendenciaSemanaSchema),
  message: z.string(),
});

export const TrabajosExtraordinariosResponseSchema = z.object({
  data: z.array(TrabajoExtraordinarioMesSchema),
  message: z.string(),
});

export const InsumosBajoStockResponseSchema = z.object({
  data: z.array(InsumoBajoStockSchema),
  message: z.string(),
});
