import { z } from 'zod';

/**
 * Fecha estimada de la próxima mantención por uso promedio
 * (`GET /api/maintenance-forecast`, backend `src/mantenimiento/pronostico/`).
 * Pesados en horas máquina (horómetro), livianos en km (odómetro).
 */
export const FORECAST_STATUSES = ['ESTIMADA', 'TOCA_AHORA', 'FALTAN_DATOS', 'SIN_USO', 'LEJANA'] as const;
export type ForecastStatus = (typeof FORECAST_STATUSES)[number];

export const MaintenanceForecastRowSchema = z.object({
  equipmentId: z.string(),
  unit: z.enum(['h', 'km']),
  /** La pauta del equipo, o el ciclo fijo de 10.000 km de un liviano. */
  source: z.enum(['PAUTA', 'LIVIANO']),
  nextAt: z.number(),
  remaining: z.number(),
  status: z.enum(FORECAST_STATUSES),
  /** Uso por día, en h o km. */
  dailyUsage: z.number().nullable(),
  basedOnDays: z.number().nullable(),
  /** `YYYY-MM-DD`. */
  estimatedDate: z.string().nullable(),
  weekStart: z.string().nullable(),
  /** El día de menos uso de esa semana; `null` sin historial suficiente. */
  suggestedDate: z.string().nullable(),
});
export type MaintenanceForecastRow = z.infer<typeof MaintenanceForecastRowSchema>;

export const MaintenanceForecastListResponseSchema = z.object({
  data: z.array(MaintenanceForecastRowSchema),
  message: z.string(),
});
