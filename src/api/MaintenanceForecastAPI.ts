import { axiosInstance } from '../lib/axios';
import { toDomainError } from '../lib/api-error';
import { MaintenanceForecastListResponseSchema, type MaintenanceForecastRow } from '../types/maintenance-forecast';

/** Fecha estimada de la próxima mantención de cada equipo (solo lectura). */
export const MaintenanceForecastAPI = {
  async list(): Promise<MaintenanceForecastRow[]> {
    try {
      const response = await axiosInstance.get('/api/maintenance-forecast');
      return MaintenanceForecastListResponseSchema.parse(response.data).data;
    } catch (error: unknown) {
      throw toDomainError(error, 'No se pudo calcular la fecha estimada de las mantenciones.');
    }
  },
};
