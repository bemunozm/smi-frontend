import type { AxiosRequestConfig } from 'axios';

import { axiosInstance as api } from '../lib/axios';
import { toDomainError } from '../lib/api-error';
import type { ApiResponse } from '../types/api';
import type { CreateHallazgoBody, Hallazgo } from '../types/hallazgos';

export async function listHallazgos(): Promise<Hallazgo[]> {
  const res = await api.get<ApiResponse<Hallazgo[]>>('/api/hallazgos');
  return res.data.data;
}

/**
 * `payload.id` es la clave de idempotencia: reenviar el mismo `id` devuelve
 * el mismo hallazgo sin volver a notificar (ver `offline/replay.ts`). Pasa
 * por `toDomainError` para que `code`/`status` lleguen intactos al outbox.
 */
export async function createHallazgo(payload: CreateHallazgoBody, config?: AxiosRequestConfig): Promise<Hallazgo> {
  try {
    const res = await api.post<ApiResponse<Hallazgo>>('/api/hallazgos', payload, config);
    return res.data.data;
  } catch (error: unknown) {
    throw toDomainError(error, 'No se pudo registrar el hallazgo.');
  }
}
