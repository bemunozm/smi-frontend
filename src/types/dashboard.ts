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

/** ← Flota/Inventario (`GET /api/equipos`, contar `estado === 'DISPONIBLE'` / total). */
export const EquiposDisponiblesSchema = z.object({
  disponibles: z.number().int().nonnegative(),
  total: z.number().int().nonnegative(),
});

export const DashboardSummarySchema = z.object({
  equiposDisponibles: EquiposDisponiblesSchema,
  /** ← Terreno: `GET /api/hallazgos?estado=ABIERTO`, contar `data.length`. */
  hallazgosAbiertos: z.number().int().nonnegative(),
  /** ← Mantenimiento: motor preventivo por umbral de horómetro (Fase 2). */
  proximasMantenciones: z.number().int().nonnegative(),
  /** ← Terreno: suma de `monto` en `TrabajoExtraordinario`. CLP. Sujeto a
   *  confirmación — el campo `monto` fue eliminado del modelo, pendiente
   *  reponerlo con Alexander. */
  ingresosTrabajosExtra: z.number().nonnegative(),
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
