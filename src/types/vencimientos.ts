import { z } from 'zod';

/**
 * Calendario anual de vencimientos de los vehículos livianos (Módulo 4 · R21):
 * 12 meses por patente con los documentos que vencen y la próxima mantención.
 * Ver `smi-backend/src/mantenimiento/vencimientos/`.
 */

export const CalendarDocumentSchema = z.object({
  id: z.string(),
  type: z.string(),
  /** «Revisión técnica», «Seguro»… */
  label: z.string(),
  /** `YYYY-MM-DD`. */
  expiryDate: z.string(),
  /** `YYYY-MM`: el mes del calendario donde cae. */
  month: z.string(),
  status: z.enum(['VIGENTE', 'POR_VENCER', 'VENCIDO', 'SIN_DATO']),
  daysToExpiry: z.number().nullable(),
  alertDaysBefore: z.number(),
});
export type CalendarDocument = z.infer<typeof CalendarDocumentSchema>;

export const CalendarServiceSchema = z.object({
  /** La pauta propia del equipo o la regla de livianos (cada 10.000 km). */
  source: z.enum(['PAUTA', 'LIVIANO']),
  unit: z.enum(['h', 'km']),
  nextAt: z.number(),
  remaining: z.number(),
  /** Ya está dentro del margen de aviso. */
  due: z.boolean(),
});
export type CalendarService = z.infer<typeof CalendarServiceSchema>;

export const CalendarEquipmentSchema = z.object({
  id: z.string(),
  internalCode: z.string(),
  licensePlate: z.string().nullable(),
  type: z.string(),
  brand: z.string(),
  model: z.string(),
  controlUnit: z.enum(['KM', 'HOURS']),
  counter: z.number().nullable(),
  documents: z.array(CalendarDocumentSchema),
  service: CalendarServiceSchema.nullable(),
});
export type CalendarEquipment = z.infer<typeof CalendarEquipmentSchema>;

export const CalendarViewSchema = z.object({
  months: z.array(z.string()),
  equipment: z.array(CalendarEquipmentSchema),
});
export type CalendarView = z.infer<typeof CalendarViewSchema>;

export const CalendarViewResponseSchema = z.object({ data: CalendarViewSchema });
