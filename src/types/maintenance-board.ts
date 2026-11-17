import { z } from 'zod';

import { EQUIPMENT_STATUS } from './equipment';
import { PlanItemSchema } from './maintenance-plan';

/**
 * Una fila de la pizarra de mantenciones (`GET /api/maintenance-plans/board`,
 * backend `maintenance-board.ts`): un equipo con su último cambio real y su
 * próximo cambio contado desde ahí. Espeja `MaintenanceBoardRow` del backend
 * para que la pizarra no recalcule nada por su cuenta.
 */
export const MaintenanceBoardRowSchema = z.object({
  equipmentId: z.string(),
  internalCode: z.string(),
  type: z.string(),
  brand: z.string().nullable(),
  model: z.string().nullable(),
  equipmentClass: z.enum(['HEAVY', 'LIGHT']),
  unit: z.enum(['h', 'km']),
  status: z.enum(EQUIPMENT_STATUS),
  counter: z.number().nullable(),
  /** PAUTA = pauta por hitos; LIVIANO = servicio fijo de 10.000 km; SIN_PAUTA = nada que contar. */
  source: z.enum(['PAUTA', 'LIVIANO', 'SIN_PAUTA']),
  milestones: z.array(z.number()),
  initialMilestone: z.number().nullable(),
  /** El último cambio real (el ancla); `null` si el equipo nunca registró uno. */
  lastChange: z.object({ milestone: z.number(), counterAt: z.number(), doneAt: z.string() }).nullable(),
  /** Horas o km entre un cambio y el siguiente («Horas cambio» de la pizarra). */
  interval: z.number().nullable(),
  /** En livianos es siempre 10.000: su próximo servicio está en `dueAt`. */
  nextMilestone: z.number().nullable(),
  dueAt: z.number().nullable(),
  /** Negativo = atrasado. */
  remaining: z.number().nullable(),
  alertBefore: z.number().nullable(),
  /** Sin último cambio: el próximo sale de los hitos absolutos (respaldo). */
  estimated: z.boolean(),
  /** Las operaciones del próximo hito. */
  items: z.array(PlanItemSchema),
});
export type MaintenanceBoardRow = z.infer<typeof MaintenanceBoardRowSchema>;

/**
 * Corregir el último cambio de un equipo desde la pizarra
 * (`PATCH /api/maintenance-plans/:equipmentId/last-change`, solo ADMIN): se
 * mandan la fecha y la lectura juntas. Responde la fila de la pizarra ya
 * recalculada.
 */
export interface CorregirUltimoCambioInput {
  /** `YYYY-MM-DD`; no puede ser futura ni anterior al cambio previo. */
  doneAt: string;
  /** Lectura del cambio: entre la del cambio previo y la actual del equipo. */
  counterAt: number;
}

export const MaintenanceBoardListResponseSchema = z.object({
  data: z.array(MaintenanceBoardRowSchema),
  message: z.string(),
});
