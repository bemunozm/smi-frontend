import { axiosInstance } from '../lib/axios';
import { toDomainError } from '../lib/api-error';
import {
  CalendarViewResponseSchema,
  LightConfigViewResponseSchema,
  type CalendarView,
  type LightConfigView,
} from '../types/vencimientos';

/** Lectura del calendario de vencimientos de los vehículos livianos (Módulo 4). */
export const VencimientosAPI = {
  /** 12 meses desde `desde` (`YYYY-MM`, por defecto el mes actual); con `equipmentId`, solo ese liviano. */
  async calendario(desde?: string, equipmentId?: string): Promise<CalendarView> {
    try {
      const response = await axiosInstance.get('/api/vencimientos/calendario', {
        params: {
          ...(desde ? { desde } : {}),
          ...(equipmentId ? { equipmentId } : {}),
        },
      });
      return CalendarViewResponseSchema.parse(response.data).data;
    } catch (error: unknown) {
      throw toDomainError(error, 'No se pudo cargar el calendario de vencimientos.');
    }
  },

  /** «Asignar mantenciones» de un liviano. El guardado va por la cola (`lightVehicleConfig.save`). */
  async lightConfig(equipmentId: string): Promise<LightConfigView> {
    try {
      const response = await axiosInstance.get(`/api/vencimientos/livianos/${equipmentId}`);
      return LightConfigViewResponseSchema.parse(response.data).data;
    } catch (error: unknown) {
      throw toDomainError(error, 'No se pudo cargar la mantención del liviano.');
    }
  },
};
