import { axiosInstance as api } from '../lib/axios';
import type { ApiResponse } from '../types/api';
import type { CombustibleForm, RegistroCombustible } from '../types/combustible';

export async function listCombustible(): Promise<RegistroCombustible[]> {
  const res = await api.get<ApiResponse<RegistroCombustible[]>>('/api/combustible');
  return res.data.data;
}

export async function createCombustible(payload: CombustibleForm): Promise<RegistroCombustible> {
  const { fotoUrl, fotoKey, ...rest } = payload;
  // Mutuamente excluyentes (ver Diseño del RFC R2-storage, "Combustible"): el
  // backend rechaza con 400 si llegan los dos juntos. `fotoKey` (Flota, vía
  // `uploadFile`) tiene prioridad; `fotoUrl` (Terreno legacy, vía
  // `uploadImage`) solo se manda cuando no hay key.
  const body = { ...rest, ...(fotoKey ? { fotoKey } : fotoUrl ? { fotoUrl } : {}) };
  const res = await api.post<ApiResponse<RegistroCombustible>>('/api/combustible', body);
  return res.data.data;
}
