import { api } from '../../../shared/api/client';
import type { ApiResponse } from '../../../shared/api/types';
import type { HallazgoForm, Hallazgo } from './schema';

export async function listHallazgos(): Promise<Hallazgo[]> {
  const res = await api.get<ApiResponse<Hallazgo[]>>('/hallazgos');
  return res.data.data;
}

export async function createHallazgo(payload: HallazgoForm): Promise<Hallazgo> {
  const body = { ...payload, fotoUrl: payload.fotoUrl || undefined };
  const res = await api.post<ApiResponse<Hallazgo>>('/hallazgos', body);
  return res.data.data;
}
