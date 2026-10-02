import { axiosInstance as api } from '../lib/axios';
import { toDomainError } from '../lib/api-error';
import type { ApiResponse } from '../types/api';
import type { EntradaCambios } from '../types/cambios';
import type { TrabajoExtraForm, TrabajoExtraordinario } from '../types/trabajosExtra';

export async function listTrabajosExtra(): Promise<TrabajoExtraordinario[]> {
  const res = await api.get<ApiResponse<TrabajoExtraordinario[]>>('/api/trabajos-extra');
  return res.data.data;
}

export async function createTrabajoExtra(payload: TrabajoExtraForm): Promise<TrabajoExtraordinario> {
  const res = await api.post<ApiResponse<TrabajoExtraordinario>>('/api/trabajos-extra', payload);
  return res.data.data;
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
