import type { AxiosRequestConfig } from 'axios';

import { axiosInstance as api } from '../lib/axios';
import { toDomainError } from '../lib/api-error';
import type { ApiResponse } from '../types/api';
import type { EntradaCambios } from '../types/cambios';
import type { CreateTrabajoExtraInput, TrabajoExtraordinario } from '../types/trabajosExtra';

export async function listTrabajosExtra(): Promise<TrabajoExtraordinario[]> {
  const res = await api.get<ApiResponse<TrabajoExtraordinario[]>>('/api/trabajos-extra');
  return res.data.data;
}

/**
 * El operador es ahora un `operatorId` del catálogo, validado en el servidor
 * (`OperatorsService.assertActive`) — puede fallar con 409 `OPERATOR_INACTIVE`
 * o 404 si el id ya no existe. `payload.id` es la clave de idempotencia. Se
 * pasa por `toDomainError` (mismo criterio que `api/ShiftCardAPI.ts#openCard`)
 * para que `error.code` llegue intacto a quien lo muestra (el replay del
 * outbox) en vez de perderse en el `message` técnico de axios.
 */
export async function createTrabajoExtra(
  payload: CreateTrabajoExtraInput,
  config?: AxiosRequestConfig,
): Promise<TrabajoExtraordinario> {
  try {
    const res = await api.post<ApiResponse<TrabajoExtraordinario>>('/api/trabajos-extra', payload, config);
    return res.data.data;
  } catch (error: unknown) {
    throw toDomainError(error, 'No se pudo registrar el trabajo extraordinario.');
  }
}

/** Lo que responde `GET /api/trabajos-extra/folio-libre`. */
export interface FolioLibre {
  folio: string;
  libre: boolean;
  /** `equipo` null: un report nulo sin equipo. */
  ocupadoPor: { id: string; equipo: string | null; nulo?: boolean; fecha: string } | null;
}

/** ¿El folio está libre? `exceptoId`: al corregir, el Report propio no cuenta. */
export async function folioLibreTrabajoExtra(folio: string, exceptoId?: string): Promise<FolioLibre> {
  try {
    const res = await api.get<ApiResponse<FolioLibre>>('/api/trabajos-extra/folio-libre', {
      params: { folio, ...(exceptoId ? { exceptoId } : {}) },
    });
    return res.data.data;
  } catch (error) {
    throw toDomainError(error, 'No se pudo revisar el N° de report.');
  }
}

/** Quién cambió qué de un trabajo, del cambio más reciente al más viejo. */
export async function listCambiosTrabajoExtra(id: string): Promise<EntradaCambios[]> {
  try {
    const res = await api.get<ApiResponse<EntradaCambios[]>>(`/api/trabajos-extra/${id}/changes`);
    return res.data.data;
  } catch (error) {
    throw toDomainError(error, 'No se pudo cargar el historial de cambios.');
  }
}

/** Eliminación definitiva — endpoint solo ADMIN. */
export async function deleteTrabajoExtra(id: string): Promise<void> {
  try {
    await api.delete(`/api/trabajos-extra/${id}`);
  } catch (error) {
    throw toDomainError(error, 'No se pudo eliminar el report.');
  }
}
