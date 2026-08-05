import { axiosInstance as api } from '../lib/axios';
import type { ApiResponse } from '../types/api';
import type { HorometroForm, RegistroHorometro } from '../types/horometro';

export async function listHorometro(): Promise<RegistroHorometro[]> {
  const res = await api.get<ApiResponse<RegistroHorometro[]>>('/api/horometro');
  return res.data.data;
}

export async function createHorometro(payload: HorometroForm): Promise<RegistroHorometro> {
  const res = await api.post<ApiResponse<RegistroHorometro>>('/api/horometro', payload);
  return res.data.data;
}
