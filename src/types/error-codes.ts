/**
 * Espejo en el frontend de los códigos de negocio que expone el backend
 * (`HttpExceptionFilter#code`, ver `smi-backend/src/common/errors/error-codes.ts`)
 * más los códigos propios del cliente (`PHOTO_MISSING`, `INVALID_RESPONSE`,
 * `STORAGE_FULL`, `FILE_TOO_LARGE`, `FILE_TYPE_NOT_ALLOWED`, `ENDPOINT_NOT_QUEUEABLE`,
 * ver `lib/api-error.ts#toDomainError` y `offline/replay.ts`). Fuente única
 * de los strings — `lib/error-messages.ts` los usa para tipar el mapa de
 * mensajes, en vez de un `string` suelto que aceptaría cualquier typo.
 */
export const ERROR_CODES = [
  'EQUIPMENT_BUSY',
  'EQUIPMENT_NOT_OPERATIONAL',
  'ID_CONFLICT',
  'CARD_NOT_FOUND',
  'ALREADY_CLOSED',
  'NOT_OWNER',
  'HOURMETER_BELOW_INITIAL',
  'INVALID_CAPTURE_TIME',
  'INVALID_SHIFT_DATE',
  'TMP_KEY_EXPIRED',
  'SHIFT_CARD_CLOSE_ELSEWHERE',
  'SHIFT_NOT_FOUND',
  'NO_CARDS',
  'REPORT_RATE_LIMITED',
  'OPERATOR_IN_USE',
  'OPERATOR_INACTIVE',
  'STALE_UPDATE',
  'CARD_NOT_CLOSED',
  'INSUFFICIENT_STOCK',
  // Códigos SOLO del cliente — nunca los manda el backend.
  'PHOTO_MISSING',
  'INVALID_RESPONSE',
  'STORAGE_FULL',
  'FILE_TOO_LARGE',
  'FILE_TYPE_NOT_ALLOWED',
  'ENDPOINT_NOT_QUEUEABLE',
] as const;

export type ErrorCode = (typeof ERROR_CODES)[number];
