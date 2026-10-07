import { z } from 'zod';

/**
 * Pauta de mantención preventiva de un equipo: la matriz de las planillas del
 * cliente (operaciones × hitos de horas o km). El hito más alto es el largo
 * del ciclo — al llegar a él el contador vuelve a cero. Ver
 * `smi-backend/src/mantenimiento/maintenance-plans/`.
 */

export const PLAN_ITEM_KINDS = ['FILTRO', 'ACEITE', 'CORREA', 'OPERACION'] as const;
export type PlanItemKind = (typeof PLAN_ITEM_KINDS)[number];

export const planItemKindLabel: Record<PlanItemKind, string> = {
  FILTRO: 'Filtro',
  ACEITE: 'Aceite',
  CORREA: 'Correa',
  OPERACION: 'Operación',
};

export const PlanItemSchema = z.object({
  id: z.string(),
  kind: z.string(),
  description: z.string(),
  quantity: z.number().nullable(),
  unit: z.string().nullable(),
  partNumber: z.string().nullable(),
  inventoryItemId: z.string().nullable(),
  milestones: z.array(z.number()),
});
export type PlanItem = z.infer<typeof PlanItemSchema>;

export const NextMaintenanceSchema = z.object({
  milestone: z.number(),
  firstTimeOnly: z.boolean(),
  /** Cuánto falta, en horas o km. 0 = toca ahora. */
  remaining: z.number(),
  dueAt: z.number(),
  items: z.array(PlanItemSchema),
});
export type NextMaintenance = z.infer<typeof NextMaintenanceSchema>;

export const MaintenanceStatusSchema = z.object({
  counter: z.number().nullable(),
  cycleLength: z.number().nullable(),
  positionInCycle: z.number().nullable(),
  next: NextMaintenanceSchema.nullable(),
});
export type MaintenanceStatus = z.infer<typeof MaintenanceStatusSchema>;

export const MaintenancePlanViewSchema = z.object({
  equipment: z.object({
    id: z.string(),
    internalCode: z.string(),
    unit: z.enum(['h', 'km']),
    counter: z.number().nullable(),
  }),
  plan: z
    .object({
      milestones: z.array(z.number()),
      initialMilestone: z.number().nullable(),
      items: z.array(PlanItemSchema),
      updatedAt: z.string(),
    })
    .nullable(),
  status: MaintenanceStatusSchema,
});
export type MaintenancePlanView = z.infer<typeof MaintenancePlanViewSchema>;

export const MaintenancePlanViewResponseSchema = z.object({
  data: MaintenancePlanViewSchema,
  message: z.string(),
});

export const MaintenanceStatusRowSchema = z.object({
  equipmentId: z.string(),
  unit: z.enum(['h', 'km']),
  status: MaintenanceStatusSchema,
});
export type MaintenanceStatusRow = z.infer<typeof MaintenanceStatusRowSchema>;

export const MaintenanceStatusListResponseSchema = z.object({
  data: z.array(MaintenanceStatusRowSchema),
  message: z.string(),
});

/** Una fila de la pauta tal como se guarda. */
export type SavePlanItemInput = {
  kind: PlanItemKind;
  description: string;
  quantity?: number;
  unit?: string;
  partNumber?: string;
  inventoryItemId?: string;
  milestones: number[];
}

/** `PUT /api/maintenance-plans/:equipmentId`: la pauta entera. */
export type SaveMaintenancePlanInput = {
  milestones: number[];
  initialMilestone?: number | null;
  items: SavePlanItemInput[];
}
