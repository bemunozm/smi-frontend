import axios from 'axios';

import { axiosInstance as api } from '../lib/axios';
import { toDomainError } from '../lib/api-error';
import type { ApiResponse } from '../types/api';

export async function uploadImage(file: File): Promise<string> {
  const form = new FormData();
  form.append('file', file);
  // `Content-Type: multipart/form-data` explícito: la instancia axios fuerza
  // `application/json`, y axios v1 con ese header serializa el FormData a JSON
  // (el archivo no llega al backend → "No se recibió archivo"). Con este
  // override el navegador arma el multipart con boundary correctamente.
  const res = await api.post<ApiResponse<{ url: string }>>('/api/uploads', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return res.data.data.url;
}

export interface UploadedFile {
  /** Key `tmp/<userId>/<uuid>.<ext>` — se manda tal cual en el `photoKey`/
   * `fileKey`/`fotoKey` del formulario que reclama el archivo al guardar (ver
   * Diseño del RFC R2-storage, "Claim en los servicios de dominio"). */
  key: string;
  /** URL firmada (válida ~1h) para previsualizar el archivo recién subido
   * antes de guardar el formulario. */
  url: string;
}

const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;
const ACCEPTED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'application/pdf']);
const SIZE_ERROR_MESSAGE = 'El archivo supera el máximo de 8 MB.';
const TYPE_ERROR_MESSAGE = 'Formato no permitido. Solo se aceptan JPG, PNG, WebP o PDF.';

/**
 * Sube un archivo a `POST /api/files` (bucket privado R2/MinIO, ver Diseño
 * del RFC R2-storage) — reemplaza a `uploadImage`/`POST /api/uploads` para
 * Flota (foto de equipo, documento de equipo, foto de carga de combustible).
 * `uploadImage`/`POST /api/uploads` se mantienen intactos para Terreno.
 *
 * Valida tamaño y tipo EN EL CLIENTE antes de la request (mismo límite/
 * vocabulario que el backend) para dar un mensaje inmediato sin gastar el
 * round-trip — el backend igual revalida por BYTES reales (magic bytes,
 * `StorageService.putTmp`), así que este chequeo es solo una mejora de UX,
 * nunca la fuente de verdad. 413/415 del backend se mapean a los mismos
 * mensajes: el 413 por defecto de Multer/Nest no viene en español, y el 415
 * queda unificado con el pre-chequeo de acá.
 */
export async function uploadFile(file: File): Promise<UploadedFile> {
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new Error(SIZE_ERROR_MESSAGE);
  }
  if (!ACCEPTED_MIME_TYPES.has(file.type)) {
    throw new Error(TYPE_ERROR_MESSAGE);
  }

  const form = new FormData();
  form.append('file', file);
  try {
    // Mismo gotcha que `uploadImage`: hay que forzar el `Content-Type` para
    // que axios arme el multipart en vez de serializar el `FormData` a JSON.
    const res = await api.post<ApiResponse<UploadedFile>>('/api/files', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return res.data.data;
  } catch (error: unknown) {
    if (axios.isAxiosError(error)) {
      if (error.response?.status === 413) throw new Error(SIZE_ERROR_MESSAGE);
      if (error.response?.status === 415) throw new Error(TYPE_ERROR_MESSAGE);
    }
    throw toDomainError(error, 'No se pudo subir el archivo.');
  }
}

// Convierte una ruta del backend (/uploads/x.jpg) en URL absoluta servible por <img>.
export function assetUrl(path?: string | null): string | undefined {
  if (!path) return undefined;
  if (/^(https?:|data:|blob:)/.test(path)) return path;
  const base = (import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api').replace(/\/api\/?$/, '');
  return `${base}${path}`;
}
