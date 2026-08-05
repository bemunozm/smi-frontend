import { axiosInstance as api } from '../lib/axios';
import type { ApiResponse } from '../types/api';
import type { TrabajoExtraForm, TrabajoExtraordinario } from '../types/trabajosExtra';

export async function listTrabajosExtra(): Promise<TrabajoExtraordinario[]> {
  const res = await api.get<ApiResponse<TrabajoExtraordinario[]>>('/api/trabajos-extra');
  return res.data.data;
}

export async function createTrabajoExtra(payload: TrabajoExtraForm): Promise<TrabajoExtraordinario> {
  const res = await api.post<ApiResponse<TrabajoExtraordinario>>('/api/trabajos-extra', payload);
  return res.data.data;
}
