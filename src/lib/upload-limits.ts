/**
 * Límites de un archivo subido a `POST /api/files` — los mismos que valida el
 * backend. Viven acá (no en `api/UploadsAPI.ts`) porque también los usa el
 * outbox al guardar un archivo en el equipo: así un archivo que el servidor iba
 * a rechazar se avisa al elegirlo, no al sincronizar horas después.
 */
export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;

const ACCEPTED_MIME_TYPES: ReadonlySet<string> = new Set(['image/jpeg', 'image/png', 'image/webp', 'application/pdf']);

export const UPLOAD_SIZE_ERROR_MESSAGE = 'El archivo supera el máximo de 8 MB.';
export const UPLOAD_TYPE_ERROR_MESSAGE = 'Formato no permitido. Solo se aceptan JPG, PNG, WebP o PDF.';

export function isAcceptedUploadType(mime: string): boolean {
  return ACCEPTED_MIME_TYPES.has(mime);
}
