import { axiosInstance as api } from '../lib/axios';
import type { ApiResponse } from '../types/api';
import type { AsistenciaMes } from '../types/asistencia';

export async function getAsistencia(mes: string): Promise<AsistenciaMes> {
  const res = await api.get<ApiResponse<AsistenciaMes>>('/api/asistencia', { params: { mes } });
  return res.data.data;
}
