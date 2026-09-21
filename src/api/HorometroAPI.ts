import { axiosInstance as api } from '../lib/axios';
import { toDomainError } from '../lib/api-error';
import type { ApiResponse } from '../types/api';
import type { CerrarHorometroInput, HorometroForm, RegistroHorometro } from '../types/horometro';

export async function listHorometro(): Promise<RegistroHorometro[]> {
  const res = await api.get<ApiResponse<RegistroHorometro[]>>('/api/horometro');
  return res.data.data;
}

/**
 * ENTRADA del flujo de dos pasos (Flota): abre un turno (omite `valorFinal`
 * — ver `types/horometro.ts`). El backend rechaza con 400 si el equipo YA
 * tiene un turno abierto, y ese mensaje tiene que llegar tal cual al
 * usuario — por eso, a diferencia de `listHorometro`, acá SÍ se pasa por
 * `toDomainError` (mismo criterio que `api/EquipmentAPI.ts`): sin esto, un
 * 400 de axios se propaga con su `message` técnico genérico ("Request
 * failed with status code 400") en vez del texto real del backend.
 */
export async function createHorometro(payload: HorometroForm): Promise<RegistroHorometro> {
  try {
    const res = await api.post<ApiResponse<RegistroHorometro>>('/api/horometro', payload);
    return res.data.data;
  } catch (error: unknown) {
    throw toDomainError(error, 'No se pudo registrar la entrada.');
  }
}

/**
 * SALIDA del flujo de dos pasos: cierra un turno abierto. El backend
 * rechaza con 404 (el turno no existe), 409 (ya está cerrado) o 400
 * (`valorFinal` menor que `valorInicial`) — los tres mensajes deben llegar
 * tal cual al usuario, mismo motivo que `createHorometro`.
 */
export async function cerrarHorometro(id: string, payload: CerrarHorometroInput): Promise<RegistroHorometro> {
  try {
    const res = await api.patch<ApiResponse<RegistroHorometro>>(`/api/horometro/${id}/salida`, payload);
    return res.data.data;
  } catch (error: unknown) {
    throw toDomainError(error, 'No se pudo registrar la salida.');
  }
}
