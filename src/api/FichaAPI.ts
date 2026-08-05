import { axiosInstance } from '../lib/axios';
import { toDomainError } from '../lib/api-error';
import { FichaResponseSchema, type FichaEquipo } from '../types/ficha';

async function getFicha(equipoId: string): Promise<FichaEquipo> {
  try {
    const response = await axiosInstance.get(`/api/equipos/${equipoId}/ficha`);
    return FichaResponseSchema.parse(response.data).data;
  } catch (error: unknown) {
    throw toDomainError(error, 'No se pudo obtener la ficha consolidada del equipo.');
  }
}

export const FichaAPI = {
  getFicha,
};
