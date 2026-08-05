import { axiosInstance as api } from '../lib/axios';
import type { ApiResponse } from '../types/api';

export interface Equipo {
  id: string;
  codigo: string;
  tipo: string;
  marca: string;
  modelo: string;
  estado: string;
  horometroActual: number;
  kilometrajeActual: number;
}

export async function listEquipos(): Promise<Equipo[]> {
  const res = await api.get<ApiResponse<Equipo[]>>('/api/equipos');
  return res.data.data;
}
