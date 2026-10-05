import type { AxiosRequestConfig } from 'axios';

import { axiosInstance as api } from '../lib/axios';
import { toDomainError } from '../lib/api-error';
import type { ApiResponse } from '../types/api';
import type { EntradaCambios } from '../types/cambios';
import type { CreateTrabajoExtraInput, TrabajoExtraForm, TrabajoExtraordinario } from '../types/trabajosExtra';

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

/**
 * Edita un trabajo ya registrado (Acta N.° 004, R13). El servidor guarda qué
 * cambió y avisa al administrador; acá solo se manda el registro completo.
 */
export async function updateTrabajoExtra({
  id,
  payload,
}: {
  id: string;
  payload: TrabajoExtraForm;
}): Promise<TrabajoExtraordinario> {
  try {
    const res = await api.patch<ApiResponse<TrabajoExtraordinario>>(`/api/trabajos-extra/${id}`, payload);
    return res.data.data;
  } catch (error) {
    throw toDomainError(error, 'No se pudo guardar el cambio.');
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
