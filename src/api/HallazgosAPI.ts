import { axiosInstance as api } from '../lib/axios';
import { toDomainError } from '../lib/api-error';
import type { ApiResponse } from '../types/api';
import type { EntradaCambios } from '../types/cambios';
import type { HallazgoForm, Hallazgo } from '../types/hallazgos';

export async function listHallazgos(): Promise<Hallazgo[]> {
  const res = await api.get<ApiResponse<Hallazgo[]>>('/api/hallazgos');
  return res.data.data;
}

export async function createHallazgo(payload: HallazgoForm): Promise<Hallazgo> {
  const body = { ...payload, fotoUrl: payload.fotoUrl || undefined };
  const res = await api.post<ApiResponse<Hallazgo>>('/api/hallazgos', body);
  return res.data.data;
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
