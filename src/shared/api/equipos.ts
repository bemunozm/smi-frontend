import { api } from './client';
import type { ApiResponse } from './types';

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
  const res = await api.get<ApiResponse<Equipo[]>>('/equipos');
  return res.data.data;
}
