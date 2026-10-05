import axios from 'axios';
import type { AxiosRequestConfig } from 'axios';

import { axiosInstance as api } from '../lib/axios';
import { DomainError, toDomainError } from '../lib/api-error';
import {
  isAcceptedUploadType,
  MAX_UPLOAD_BYTES,
  UPLOAD_SIZE_ERROR_MESSAGE,
  UPLOAD_TYPE_ERROR_MESSAGE,
} from '../lib/upload-limits';
import type { ApiResponse } from '../types/api';

export interface UploadedFile {
  /** Key `tmp/<userId>/<uuid>.<ext>` — se manda tal cual en el `photoKey`/
   * `fileKey`/`fotoKey` del formulario que reclama el archivo al guardar. */
  key: string;
  /** URL firmada (válida ~1h) para previsualizar el archivo recién subido
   * antes de guardar el formulario. */
  url: string;
}

/**
 * Sube un archivo a `POST /api/files` (bucket privado R2/MinIO). Es la única vía
 * de subida: el replay la usa para los archivos que una operación guardó en el
 * equipo.
 *
 * Valida tamaño y tipo EN EL CLIENTE antes de la request (mismo límite y
 * vocabulario que el backend) para dar un mensaje inmediato sin gastar el
 * round-trip. El backend igual revalida por BYTES reales (magic bytes): este
 * chequeo es una mejora de UX, nunca la fuente de verdad.
 *
 * Un archivo inválido es un rechazo de negocio, no un fallo de red: lanza un
 * `DomainError` con `code` (`FILE_TOO_LARGE`, `FILE_TYPE_NOT_ALLOWED`), y el 413
 * o 415 del servidor igual (con su `status`). El replay los manda a "requiere
 * atención" en vez de reintentarlos para siempre. El 413 por defecto de Multer/
 * Nest no viene en español y el 415 queda unificado con el pre-chequeo.
 *
 * `config` es opcional: el replay manda un timeout proporcional al tamaño del
 * archivo, porque subir una foto pesa mucho más que un JSON.
 */
export async function uploadFile(file: File, config?: AxiosRequestConfig): Promise<UploadedFile> {
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new DomainError(UPLOAD_SIZE_ERROR_MESSAGE, { code: 'FILE_TOO_LARGE' });
  }
  if (!isAcceptedUploadType(file.type)) {
    throw new DomainError(UPLOAD_TYPE_ERROR_MESSAGE, { code: 'FILE_TYPE_NOT_ALLOWED' });
  }

  const form = new FormData();
  form.append('file', file);
  try {
    // Hay que forzar el `Content-Type` para que axios arme el multipart en vez
    // de serializar el `FormData` a JSON.
    const res = await api.post<ApiResponse<UploadedFile>>('/api/files', form, {
      ...config,
      headers: { ...config?.headers, 'Content-Type': 'multipart/form-data' },
    });
    return res.data.data;
  } catch (error: unknown) {
    if (axios.isAxiosError(error)) {
      const status = error.response?.status;
      if (status === 413) throw new DomainError(UPLOAD_SIZE_ERROR_MESSAGE, { code: 'FILE_TOO_LARGE', status });
      if (status === 415) throw new DomainError(UPLOAD_TYPE_ERROR_MESSAGE, { code: 'FILE_TYPE_NOT_ALLOWED', status });
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
