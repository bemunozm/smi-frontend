import { axiosInstance as api } from '../lib/axios';
import type { ApiResponse } from '../types/api';
import type { RegistroHorometro } from '../types/horometro';

export async function listHorometro(): Promise<RegistroHorometro[]> {
  const res = await api.get<ApiResponse<RegistroHorometro[]>>('/api/horometro');
  return res.data.data;
}

