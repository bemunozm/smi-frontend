import type { AxiosRequestConfig } from 'axios';

import { axiosInstance as api } from '../lib/axios';
import { toDomainError } from '../lib/api-error';
import type { ApiResponse } from '../types/api';
import type { EntradaCambios } from '../types/cambios';
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

/** Lo que se puede corregir de un hallazgo ya registrado (R13). La foto no. */
export interface CorreccionHallazgo {
  equipoId: string;
  descripcion: string;
  prioridad: string;
  estado: string;
}

/**
 * Corrige un hallazgo ya registrado (Acta N.° 004, R13). El servidor guarda
 * qué cambió y avisa al administrador.
 */
export async function updateHallazgo({
  id,
  payload,
}: {
  id: string;
  payload: CorreccionHallazgo;
}): Promise<Hallazgo> {
  try {
    const res = await api.patch<ApiResponse<Hallazgo>>(`/api/hallazgos/${id}`, payload);
    return res.data.data;
  } catch (error) {
    throw toDomainError(error, 'No se pudo guardar el cambio.');
  }
}

/** Quién cambió qué de un hallazgo, del cambio más reciente al más viejo. */
export async function listCambiosHallazgo(id: string): Promise<EntradaCambios[]> {
  try {
    const res = await api.get<ApiResponse<EntradaCambios[]>>(`/api/hallazgos/${id}/changes`);
    return res.data.data;
  } catch (error) {
    throw toDomainError(error, 'No se pudo cargar el historial de cambios.');
  }
}
