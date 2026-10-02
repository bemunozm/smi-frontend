import { axiosInstance as api } from '../lib/axios';
import { toDomainError } from '../lib/api-error';
import type { ApiResponse } from '../types/api';
import type { TrabajoExtraForm, TrabajoExtraordinario } from '../types/trabajosExtra';

export async function listTrabajosExtra(): Promise<TrabajoExtraordinario[]> {
  const res = await api.get<ApiResponse<TrabajoExtraordinario[]>>('/api/trabajos-extra');
  return res.data.data;
}

/**
 * El operador es ahora un `operatorId` del catálogo, validado en el servidor
 * (`OperatorsService.assertActive`) — puede fallar con 409 `OPERATOR_INACTIVE`
 * o 404 si el id ya no existe. Se pasa por `toDomainError` (mismo criterio
 * que `api/ShiftCardAPI.ts#openCard`) para que `error.code` llegue intacto a
 * `hooks/useTrabajosExtra.ts#mensajeErrorTrabajoExtra` en vez de perderse en
 * el `message` técnico de axios.
 */
export async function createTrabajoExtra(payload: TrabajoExtraForm): Promise<TrabajoExtraordinario> {
  try {
    const res = await api.post<ApiResponse<TrabajoExtraordinario>>('/api/trabajos-extra', payload);
    return res.data.data;
  } catch (error: unknown) {
    throw toDomainError(error, 'No se pudo registrar el trabajo extraordinario.');
  }
}
