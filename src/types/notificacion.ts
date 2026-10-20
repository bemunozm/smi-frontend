import { z } from 'zod';

/**
 * Tipos de notificación conocidos por el frontend (para mapear color/label en
 * `config/notificacion-colors.ts`). El schema de abajo NO los usa como enum
 * estricto a propósito: si el backend agrega un tipo nuevo, la respuesta debe
 * seguir validando (aprendido de un bug previo donde un `z.enum` estricto
 * rompió toda una vista al aparecer un valor no contemplado).
 */
export const NOTIF_TIPOS = {
  HALLAZGO_CREATED: 'hallazgo.created',
  ORDEN_ASSIGNED: 'orden.assigned',
  ORDEN_COMPLETED: 'orden.completed',
  /** Stock de una bodega cruzó su mínimo — mismo literal que
   * `DOMAIN_EVENTS.ITEM_LOW_STOCK` del backend (antes decía `insumo.low-stock`
   * y el chip caía al fallback genérico). */
  ITEM_LOW_STOCK: 'item.low-stock',
  /** Reporte de salida de turno (`POST /api/shift-reports`) —
   * `data: { reportId, shiftId }`. */
  SHIFT_EXIT_REPORT: 'shift.exit-report',
  /** Un registro ya enviado fue corregido (solo lo recibe el administrador) —
   * `data: { entity, entityId }`, con `entity` en `RECORD_EDITED_ENTITIES`. */
  RECORD_EDITED: 'record.edited',
  /** El mantenedor envió el checklist diario de un equipo (al supervisor) —
   * `data: { checklistId, equipmentId }`. */
  CHECKLIST_SUBMITTED: 'checklist.submitted',
  /** El supervisor lo aceptó o rechazó (al mantenedor y al administrador) —
   * `data: { checklistId, equipmentId, decision }`. */
  CHECKLIST_REVIEWED: 'checklist.reviewed',
  /** Un documento de equipo entró en su plazo de aviso o venció (Módulo 4) —
   * `data: { documentId, equipmentId, kind }`. */
  DOCUMENT_EXPIRING: 'document.expiring',
  /** A un liviano le falta poco para la mantención de cada 10.000 km (Módulo 4)
   * — `data: { equipmentId, ordenId }`. */
  LIGHT_SERVICE_DUE: 'light-service.due',
} as const;

/** Qué registro corrigieron, tal como lo manda el backend en `data.entity`. */
export const RECORD_EDITED_ENTITIES = ['shift_card', 'hallazgo', 'trabajo_extra', 'reporte_diario'] as const;
export type RecordEditedEntity = (typeof RECORD_EDITED_ENTITIES)[number];

export type NotificacionTipo = (typeof NOTIF_TIPOS)[keyof typeof NOTIF_TIPOS];

/**
 * Shape real de `Notification` devuelto por `smi-backend`
 * (`GET /api/notifications`). `tipo` es `z.string()` (no `z.enum`) para
 * tolerar tipos nuevos sin romper la validación; `data` es metadata libre
 * según `tipo` (p. ej. `{ hallazgoId, equipoId }` | `{ ordenId, equipoId }` |
 * `{ insumoId, stock, stockMinimo }`).
 */
export const NotificacionSchema = z.object({
  id: z.string(),
  userId: z.string(),
  tipo: z.string(),
  titulo: z.string(),
  cuerpo: z.string(),
  data: z.record(z.string(), z.unknown()).nullable(),
  leida: z.boolean(),
  createdAt: z.string(),
});

export type Notificacion = z.infer<typeof NotificacionSchema>;

/** Envoltura `{ data, message }` de `GET /api/notifications`. */
export const NotificacionesResponseSchema = z.object({
  data: z.array(NotificacionSchema),
  message: z.string(),
});

/** `GET /api/notifications/unread-count` → `{ data: { count }, message }`. */
export const UnreadCountResponseSchema = z.object({
  data: z.object({ count: z.number() }),
  message: z.string(),
});

/** `PATCH /api/notifications/:id/read` → `{ data: { id }, message }`. */
export const MarkReadResponseSchema = z.object({
  data: z.object({ id: z.string() }),
  message: z.string(),
});

/** `PATCH /api/notifications/read-all` → `{ data: null, message }`. */
export const MarkAllResponseSchema = z.object({
  data: z.null(),
  message: z.string(),
});
