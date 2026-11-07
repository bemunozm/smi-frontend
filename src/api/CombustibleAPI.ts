import { axiosInstance as api } from '../lib/axios';
import type { ApiResponse } from '../types/api';
import type { RegistroCombustible } from '../types/combustible';

export async function listCombustible(): Promise<RegistroCombustible[]> {
  const res = await api.get<ApiResponse<RegistroCombustible[]>>('/api/combustible');
  return res.data.data;
}

export interface CreateCombustibleBody {
  /** UUID generado por el cliente: un reintento del POST no duplica la carga. */
  id: string;
  equipoId: string;
  litros: number;
  tipo: 'PETROLEO' | 'BENCINA';
  /** ISO datetime; sin ella el backend cae a `@default(now())`. */
  fecha?: string;
  /** Lectura del contador al cargar: horómetro (h) si el equipo es pesado,
   * kilometraje (km) si es liviano. El backend la persiste y adelanta el
   * contador del equipo (nunca lo retrocede). */
  lectura?: number;
  /** Key `tmp/<userId>/<uuid>.<ext>` de la foto ya subida (`uploadFile`). */
  fotoKey?: string;
}

/** POST directo (online) — el alta del panel admin. El alta de Terreno va por
 * el outbox (`combustible.create`), no por acá. */
export async function createCombustible(body: CreateCombustibleBody): Promise<RegistroCombustible> {
  const res = await api.post<ApiResponse<RegistroCombustible>>('/api/combustible', body);
  return res.data.data;
}

