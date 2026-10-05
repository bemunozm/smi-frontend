import type { OutboxLastError } from './db';

/** Rechazos que ningún reintento arregla: el rol no tiene permiso, o el archivo
 * guardado nunca lo aceptará el servidor (tamaño, formato) o ya no existe. Lo único
 * que sirve es descartar; ofrecer "Reintentar" solo promete algo que no va a pasar. */
const NON_RETRYABLE_STATUSES: ReadonlySet<number> = new Set([403, 413, 415]);
const NON_RETRYABLE_CODES: ReadonlySet<string> = new Set([
  'FORBIDDEN',
  'FILE_TOO_LARGE',
  'FILE_TYPE_NOT_ALLOWED',
  'PHOTO_MISSING',
  'ENDPOINT_NOT_QUEUEABLE',
]);

export function isNonRetryable(error: OutboxLastError | undefined): boolean {
  if (!error) return false;
  return (error.status != null && NON_RETRYABLE_STATUSES.has(error.status)) || (error.code != null && NON_RETRYABLE_CODES.has(error.code));
}
