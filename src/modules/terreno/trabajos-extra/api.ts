import { api } from '../../../shared/api/client';
import type { ApiResponse } from '../../../shared/api/types';
import type { TrabajoExtraForm, TrabajoExtraordinario } from './schema';

export async function listTrabajosExtra(): Promise<TrabajoExtraordinario[]> {
  const res = await api.get<ApiResponse<TrabajoExtraordinario[]>>('/trabajos-extra');
  return res.data.data;
}

export async function createTrabajoExtra(payload: TrabajoExtraForm): Promise<TrabajoExtraordinario> {
  const res = await api.post<ApiResponse<TrabajoExtraordinario>>('/trabajos-extra', payload);
  return res.data.data;
}
