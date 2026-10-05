import { z } from 'zod';

import { CONTROL_UNIT } from './equipment';

/**
 * Contrato de tarjetas de turno del Módulo A (`POST/GET /api/shift-cards`,
 * backend `src/shifts/*`, RFC "Supervisión en Terreno").
 * Mismo vocabulario que `lib/turno.ts#Turno`, redeclarado acá porque este
 * archivo modela el contrato HTTP, no la lógica de reloj.
 */
export const SHIFT_TYPES = ['DIURNO', 'NOCTURNO'] as const;
export type ShiftType = (typeof SHIFT_TYPES)[number];

const ShiftCardExitReportSchema = z.object({
  id: z.string(),
  requestedAt: z.string(),
  cardCount: z.number(),
  emailStatus: z.string(),
});
export type ShiftCardExitReport = z.infer<typeof ShiftCardExitReportSchema>;

const ShiftCardShiftSchema = z.object({
  id: z.string(),
  /** `YYYY-MM-DD`, sin hora (`Shift.date @db.Date` en el backend). */
  date: z.string(),
  type: z.string(),
  exitReports: z.array(ShiftCardExitReportSchema),
});
export type ShiftCardShift = z.infer<typeof ShiftCardShiftSchema>;

/**
 * Forma pública de una tarjeta de turno — LA MISMA en `open`, `close` y
 * `mine` (`ShiftsService#shapeCard`, backend): nunca expone
 * `pumpPhotoKey`/`closeClientId` crudos (claves internas de storage/
 * idempotencia), solo la URL firmada del surtidor.
 */
export const ShiftCardResponseSchema = z.object({
  id: z.string(),
  equipoId: z.string(),
  equipo: z.object({
    internalCode: z.string(),
    type: z.string(),
    controlUnit: z.enum(CONTROL_UNIT),
  }),
  operatorId: z.string().nullable(),
  /** Snapshot de texto (`RegistroHorometro.operador`) — se mantiene aunque
   * el operador del catálogo se renombre o desactive después. */
  operatorName: z.string(),
  supervisorId: z.string().nullable(),
  supervisorName: z.string().nullable(),
  shift: ShiftCardShiftSchema.nullable(),
  valorInicial: z.number(),
  valorFinal: z.number().nullable(),
  /** `valorFinal − valorInicial`, `null` si la tarjeta sigue abierta. */
  horasMaquina: z.number().nullable(),
  fuelLiters: z.number().nullable(),
  /** AdBlue cargado en el turno. `default` cubre respuestas guardadas por el
   * Service Worker antes de que el servidor las incluyera. */
  adBlue: z.boolean().default(false),
  /** Litros de AdBlue — `null` si no se cargó. */
  adBlueLiters: z.number().nullable().default(null),
  /** URL firmada, nunca la key cruda. `null` mientras la tarjeta sigue
   * abierta (o en datos legacy sin foto). */
  pumpPhotoUrl: z.string().nullable(),
  observaciones: z.string().nullable(),
  belowPreviousReading: z.boolean(),
  fecha: z.string(),
  fechaSalida: z.string().nullable(),
  createdAt: z.string(),
  closedAt: z.string().nullable(),
});
export type ShiftCardResponse = z.infer<typeof ShiftCardResponseSchema>;

// --- Envolturas `{ data, message }` ---------------------------------------

export const ShiftCardWrapperSchema = z.object({ data: ShiftCardResponseSchema, message: z.string() });
export const ShiftCardListResponseSchema = z.object({
  data: z.array(ShiftCardResponseSchema),
  message: z.string(),
});

// --- Bodies de request -------------------------------------------------------

/** Body de `POST /api/shift-cards`. `id` es el UUID v4 generado en el
 * CLIENTE (ver `lib/uuid.ts`) — clave de idempotencia: reintentar la MISMA
 * request devuelve la misma tarjeta en vez de duplicar. */
export interface OpenShiftCardInput {
  id: string;
  equipoId: string;
  operatorId: string;
  valorInicial: number;
  /** `YYYY-MM-DD` — armado con partes LOCALES, nunca `toISOString()` (ver
   * `lib/turno.ts#toDateOnly`). */
  shiftDate: string;
  shiftType: ShiftType;
  /** Hora del DISPOSITIVO al abrir la tarjeta. */
  capturedAt: string;
}

/** Body de `POST /api/shift-cards/:id/close`. `closeClientId` es la clave
 * de idempotencia del CIERRE (distinta de `id`, ver `lib/uuid.ts`). */
export interface CloseShiftCardInput {
  closeClientId: string;
  valorFinal: number;
  /** Litros cargados al cierre — obligatorio, 0 permitido. */
  fuelLiters: number;
  /** Key `tmp/<userId>/<uuid>.<ext>` de `POST /api/files` (ver
   * `api/UploadsAPI.ts#uploadFile`). */
  tmpPhotoKey: string;
  /** AdBlue cargado en el turno. Opcional: un cierre ya encolado antes de que
   * existiera el campo sigue siendo válido. */
  adBlue?: boolean;
  /** Litros de AdBlue (> 0 y ≤ 1000) — obligatorios cuando `adBlue` es `true`. */
  adBlueLiters?: number;
  observaciones?: string;
  /** Hora del DISPOSITIVO al cerrar la tarjeta. */
  capturedAt: string;
  /** Hora del DISPOSITIVO al tomar la foto, si difiere de `capturedAt`. */
  photoCapturedAt?: string;
}

/**
 * Body de `PATCH /api/shift-cards/:id`: solo los campos que cambiaron. Los
 * de cierre (`valorFinal`, `fuelLiters`, `adBlue`, `adBlueLiters`) solo
 * aplican a una tarjeta ya cerrada (si no, 409 `CARD_NOT_CLOSED`).
 */
export type EditShiftCardBody = {
  operatorId?: string;
  valorInicial?: number;
  valorFinal?: number;
  fuelLiters?: number;
  adBlue?: boolean;
  adBlueLiters?: number;
  observaciones?: string;
};

/**
 * Contrato del reporte de salida de turno (`POST /api/shift-reports`). Se
 * manda vía el outbox offline (RFC "Supervisión en Terreno" §Diseño →
 * Offline, `offline/outbox.ts#enqueueExitReport`), nunca directo desde la
 * vista.
 */
export const EMAIL_STATUSES = ['PENDING', 'SENT', 'FAILED', 'SKIPPED'] as const;
export type EmailStatus = (typeof EMAIL_STATUSES)[number];

/** Body de `POST /api/shift-reports`. `id` es el UUID v4 generado en el
 * CLIENTE — idempotencia, igual criterio que `OpenShiftCardInput#id`. */
export interface SendExitReportInput {
  id: string;
  /** `YYYY-MM-DD` — mismo formato que `OpenShiftCardInput#shiftDate`. */
  shiftDate: string;
  shiftType: ShiftType;
  /** 1 a 100 ids de tarjeta — pueden incluir el id de una tarjeta cuya
   * apertura todavía está pendiente en el outbox: el orden FIFO del replay
   * garantiza que esa apertura ya viajó antes que el reporte. */
  cardIds: string[];
  /** Hora del DISPOSITIVO al pedir el reporte. */
  requestedAt: string;
}

export const ShiftReportResponseSchema = z.object({
  id: z.string(),
  shiftId: z.string(),
  fileName: z.string(),
  cardCount: z.number(),
  requestedAt: z.string(),
  createdAt: z.string(),
  emailStatus: z.enum(EMAIL_STATUSES),
  /** Ids del body que no se encontraron al generar el PDF — el reporte
   * igual se genera con las que sí existen (ver Diseño del RFC, `POST
   * /api/shift-reports`). */
  missingCardIds: z.array(z.string()),
});
export type ShiftReportResponse = z.infer<typeof ShiftReportResponseSchema>;

export const ShiftReportWrapperSchema = z.object({ data: ShiftReportResponseSchema, message: z.string() });
