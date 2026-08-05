import { api } from '../../../shared/api/client';
import type { ApiResponse } from '../../../shared/api/types';
import type { HorometroForm, RegistroHorometro } from './schema';

export async function listHorometro(): Promise<RegistroHorometro[]> {
  const res = await api.get<ApiResponse<RegistroHorometro[]>>('/horometro');
  return res.data.data;
}

export async function createHorometro(payload: HorometroForm): Promise<RegistroHorometro> {
  const res = await api.post<ApiResponse<RegistroHorometro>>('/horometro', payload);
  return res.data.data;
}
