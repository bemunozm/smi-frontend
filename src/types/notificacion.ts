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
  INSUMO_LOW_STOCK: 'insumo.low-stock',
  /** Reporte de salida de turno (`POST /api/shift-reports`) —
   * `data: { reportId, shiftId }`. */
  SHIFT_EXIT_REPORT: 'shift.exit-report',
  /** Un registro ya enviado fue corregido (solo lo recibe el administrador) —
   * `data: { entity, entityId }`, con `entity` en `RECORD_EDITED_ENTITIES`. */
  RECORD_EDITED: 'record.edited',
} as const;

/** Qué registro corrigieron, tal como lo manda el backend en `data.entity`. */
export const RECORD_EDITED_ENTITIES = ['shift_card', 'hallazgo', 'trabajo_extra'] as const;
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
