import type { AxiosRequestConfig } from 'axios';

import { axiosInstance as api } from '../lib/axios';
import { toDomainError } from '../lib/api-error';
import type { ApiResponse } from '../types/api';
import type { EntradaCambios } from '../types/cambios';
import type { CreateHallazgoBody, EditHallazgoBody, Hallazgo } from '../types/hallazgos';

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

/** Lo que se puede corregir de un hallazgo ya registrado: un registro enviado se
 * corrige sin autorización y queda en su historial de cambios. La foto no. La
 * corrección viaja por la cola (`offline/endpoints#hallazgo.edit`). */
export interface CorreccionHallazgo {
  equipoId: string;
  descripcion: string;
  prioridad: string;
  estado: string;
}

/**
 * Edición directa (sin cola): la usa la vista de hallazgos del administrador,
 * que trabaja online en escritorio. Terreno sigue editando por el outbox con
 * precondiciones (`useEditarHallazgo`); acá solo viajan los campos cambiados.
 */
export async function editHallazgo(id: string, body: EditHallazgoBody): Promise<Hallazgo> {
  try {
    const res = await api.patch<ApiResponse<Hallazgo>>(`/api/hallazgos/${id}`, body);
    return res.data.data;
  } catch (error) {
    throw toDomainError(error, 'No se pudo actualizar el hallazgo.');
  }
}

/** Eliminación definitiva — endpoint solo ADMIN. */
export async function deleteHallazgo(id: string): Promise<void> {
  try {
    await api.delete(`/api/hallazgos/${id}`);
  } catch (error) {
    throw toDomainError(error, 'No se pudo eliminar el hallazgo.');
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
