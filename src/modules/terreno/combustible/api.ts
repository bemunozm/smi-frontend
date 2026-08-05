import { api } from '../../../shared/api/client';
import type { ApiResponse } from '../../../shared/api/types';
import type { CombustibleForm, RegistroCombustible } from './schema';

export async function listCombustible(): Promise<RegistroCombustible[]> {
  const res = await api.get<ApiResponse<RegistroCombustible[]>>('/combustible');
  return res.data.data;
}

export async function createCombustible(payload: CombustibleForm): Promise<RegistroCombustible> {
  const body = { ...payload, fotoUrl: payload.fotoUrl || undefined };
  const res = await api.post<ApiResponse<RegistroCombustible>>('/combustible', body);
  return res.data.data;
}
