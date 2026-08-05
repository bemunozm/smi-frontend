import { axiosInstance as api } from '../lib/axios';
import type { ApiResponse } from '../types/api';
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
