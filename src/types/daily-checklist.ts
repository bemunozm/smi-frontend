import { z } from 'zod';

/**
 * Checklist diario del mantenedor (Módulo 2 · R23 + R24): por equipo y por
 * día, cada ítem del catálogo con uno de tres estados. Ver
 * `smi-backend/src/mantenimiento/daily-checklists/`.
 */

export const ENTRY_STATUSES = ['MAINTAINED', 'CHECKED', 'NOT_CHECKED'] as const;
export type EntryStatus = (typeof ENTRY_STATUSES)[number];

export const entryStatusLabel: Record<EntryStatus, string> = {
  MAINTAINED: 'Se hizo mantención',
  CHECKED: 'Se revisó',
  NOT_CHECKED: 'No se revisó',
};

/**
 * La foto es obligatoria solo cuando a un ítem crítico (`requiresPhoto`) se le
 * hizo mantención. Revisarlo no la pide; en el resto de los ítems es opcional.
 */
export function pideFoto(item: { requiresPhoto: boolean }, status: EntryStatus | null): boolean {
  return item.requiresPhoto && status === 'MAINTAINED';
}

export const ChecklistItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  position: z.number(),
  requiresPhoto: z.boolean(),
  requiresTemperature: z.boolean(),
});
export type ChecklistItem = z.infer<typeof ChecklistItemSchema>;

export const CHECKLIST_STATUSES = ['SUBMITTED', 'ACCEPTED', 'REJECTED'] as const;
export type ChecklistStatus = (typeof CHECKLIST_STATUSES)[number];

/** Una validación del supervisor (Módulo 3 · R25). */
export const ChecklistReviewSchema = z.object({
  decision: z.enum(['ACCEPTED', 'REJECTED']),
  comment: z.string().nullable(),
  reviewerName: z.string(),
  /** Qué envío se validó (1 = el primero; sube con cada corrección). */
  submission: z.number(),
  createdAt: z.string(),
});
export type ChecklistReview = z.infer<typeof ChecklistReviewSchema>;

export const DailyChecklistSummarySchema = z.object({
  id: z.string(),
  equipment: z.object({ id: z.string(), internalCode: z.string() }),
  date: z.string(),
  counter: z.number(),
  status: z.enum(CHECKLIST_STATUSES),
  mechanicName: z.string(),
  submittedAt: z.string(),
  /** 1 = primer envío; sube con cada corrección tras un rechazo. */
  submissionCount: z.number(),
  /** Revisados o con mantención. */
  declared: z.number(),
  /** Con «Se hizo mantención». */
  maintained: z.number(),
  /** Fotos adjuntas en todo el checklist. */
  photos: z.number(),
  /** La última validación del supervisor, o `null` si nunca se revisó. */
  lastReview: ChecklistReviewSchema.nullable(),
});
export type DailyChecklistSummary = z.infer<typeof DailyChecklistSummarySchema>;

export const DailyChecklistDetailSchema = DailyChecklistSummarySchema.extend({
  entries: z.array(
    z.object({
      itemId: z.string().nullable(),
      itemName: z.string(),
      status: z.enum(ENTRY_STATUSES),
      description: z.string().nullable(),
      note: z.string().nullable(),
      temperature: z.number().nullable(),
      /** `id`: el nombre del archivo, para conservar la foto al corregir. */
      photos: z.array(z.object({ id: z.string(), url: z.string() })),
      supplies: z.array(
        z.object({
          itemId: z.string(),
          sku: z.string(),
          name: z.string(),
          quantity: z.number(),
        }),
      ),
    }),
  ),
  /** Todas las validaciones, de la más vieja a la más nueva. */
  reviews: z.array(ChecklistReviewSchema),
});
export type DailyChecklistDetail = z.infer<typeof DailyChecklistDetailSchema>;

export const ChecklistItemListResponseSchema = z.object({
  data: z.array(ChecklistItemSchema),
});
export const DailyChecklistListResponseSchema = z.object({
  data: z.array(DailyChecklistSummarySchema),
});
export const DailyChecklistDetailResponseSchema = z.object({
  data: DailyChecklistDetailSchema,
});

export type DailyChecklistEntryInput = {
  itemId: string;
  status: EntryStatus;
  description?: string;
  note?: string;
  temperature?: number;
  /** Las pone la cola al subir las fotos (`entries.i.photoKeys.j`). */
  photoKeys?: string[];
  supplies?: { insumoId: string; cantidad: number }[];
};

export type SubmitDailyChecklistInput = {
  equipmentId: string;
  /** `YYYY-MM-DD`. */
  date: string;
  /** Horómetro u odómetro al hacer el checklist. No cambia la lectura del equipo. */
  counter: number;
  branchId?: string;
  entries: DailyChecklistEntryInput[];
};

/** Corregir un checklist rechazado y reenviarlo (`PUT /api/daily-checklists/:id`). */
export type ResubmitDailyChecklistInput = {
  /** El envío que se corrige (`submissionCount` del rechazado). */
  submission: number;
  counter: number;
  branchId?: string;
  /** `photoKeys` lleva los `id` de las fotos que se conservan; las nuevas las pone la cola. */
  entries: DailyChecklistEntryInput[];
};

/** La decisión del supervisor (`POST /api/daily-checklists/:id/review`). */
export type ReviewDailyChecklistInput = {
  decision: 'ACCEPTED' | 'REJECTED';
  comment?: string;
  /** El envío que se revisó: si el mantenedor lo corrigió entretanto, no aplica. */
  submission: number;
};
