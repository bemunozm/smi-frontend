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

/**
 * «Asignar mantenciones» de un liviano (Módulo 4): la mantención es siempre
 * cada 10.000 km; se configura con cuánto avisar antes de ella y de cada papel.
 */
export const LightConfigSchema = z.object({
  serviceAlertKm: z.number(),
  technicalInspectionAlertDays: z.number(),
  circulationPermitAlertDays: z.number(),
  insuranceAlertDays: z.number(),
});
export type LightConfig = z.infer<typeof LightConfigSchema>;

export const LIGHT_DOC_TYPES = ['TECHNICAL_INSPECTION', 'CIRCULATION_PERMIT', 'INSURANCE'] as const;
export type LightDocType = (typeof LIGHT_DOC_TYPES)[number];

/** Qué campo de la configuración fija el aviso de cada papel. */
export const LIGHT_DOC_ALERT_FIELD: Record<LightDocType, keyof Omit<LightConfig, 'serviceAlertKm'>> = {
  TECHNICAL_INSPECTION: 'technicalInspectionAlertDays',
  CIRCULATION_PERMIT: 'circulationPermitAlertDays',
  INSURANCE: 'insuranceAlertDays',
};

export const LightConfigViewSchema = z.object({
  equipment: z.object({
    id: z.string(),
    internalCode: z.string(),
    licensePlate: z.string().nullable(),
    brand: z.string(),
    model: z.string(),
    mileage: z.number().nullable(),
  }),
  intervalKm: z.number(),
  config: LightConfigSchema,
  service: CalendarServiceSchema.nullable(),
  documents: z.array(
    z.object({
      type: z.enum(LIGHT_DOC_TYPES),
      label: z.string(),
      expiryDate: z.string().nullable(),
      daysToExpiry: z.number().nullable(),
      status: z.enum(['VIGENTE', 'POR_VENCER', 'VENCIDO', 'SIN_DATO']).nullable(),
    }),
  ),
});
export type LightConfigView = z.infer<typeof LightConfigViewSchema>;

export const LightConfigViewResponseSchema = z.object({ data: LightConfigViewSchema });
