import { axiosInstance as api } from '../lib/axios';
import type { ApiResponse } from '../types/api';
import type { CombustibleForm, RegistroCombustible } from '../types/combustible';

export async function listCombustible(): Promise<RegistroCombustible[]> {
  const res = await api.get<ApiResponse<RegistroCombustible[]>>('/api/combustible');
  return res.data.data;
}

export async function createCombustible(payload: CombustibleForm): Promise<RegistroCombustible> {
  const body = { ...payload, fotoUrl: payload.fotoUrl || undefined };
  const res = await api.post<ApiResponse<RegistroCombustible>>('/api/combustible', body);
  return res.data.data;
}
