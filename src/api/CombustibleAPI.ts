import { axiosInstance as api } from '../lib/axios';
import type { ApiResponse } from '../types/api';
import type { RegistroCombustible } from '../types/combustible';

export async function listCombustible(): Promise<RegistroCombustible[]> {
  const res = await api.get<ApiResponse<RegistroCombustible[]>>('/api/combustible');
  return res.data.data;
}

