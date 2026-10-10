import { axiosInstance } from '../lib/axios';
import { toDomainError } from '../lib/api-error';
import {
  MaintenanceCycleViewResponseSchema,
  MaintenancePlanViewResponseSchema,
  MaintenanceStatusListResponseSchema,
  type MaintenanceCycleView,
  type MaintenancePlanView,
  type MaintenanceStatusRow,
} from '../types/maintenance-plan';

/**
 * Lecturas de las pautas de mantención. La escritura (guardar la pauta) va por
 * la cola de escrituras: `maintenancePlan.save` en `offline/endpoints/`.
 */
export const MaintenancePlanAPI = {
  /** La pauta de un equipo con su próxima mantención. `plan` es null si no tiene. */
  async get(equipmentId: string): Promise<MaintenancePlanView> {
    try {
      const response = await axiosInstance.get(`/api/maintenance-plans/${equipmentId}`);
      return MaintenancePlanViewResponseSchema.parse(response.data).data;
    } catch (error: unknown) {
      throw toDomainError(error, 'No se pudo cargar la pauta de mantención.');
    }
  },

  /** La próxima mantención de todos los equipos con pauta, en una sola llamada. */
  async statusForAll(): Promise<MaintenanceStatusRow[]> {
    try {
      const response = await axiosInstance.get('/api/maintenance-plans/status');
      return MaintenanceStatusListResponseSchema.parse(response.data).data;
    } catch (error: unknown) {
      throw toDomainError(error, 'No se pudo cargar el estado de las mantenciones.');
    }
  },

  /** Una vuelta del ciclo de mantenciones; sin `cycle`, la que está en curso. */
  async cycle(equipmentId: string, cycle?: number): Promise<MaintenanceCycleView> {
    try {
      const response = await axiosInstance.get(`/api/maintenance-plans/${equipmentId}/cycle`, {
        params: cycle != null ? { cycle } : undefined,
      });
      return MaintenanceCycleViewResponseSchema.parse(response.data).data;
    } catch (error: unknown) {
      throw toDomainError(error, 'No se pudo cargar el ciclo de mantenciones.');
    }
  },
};
