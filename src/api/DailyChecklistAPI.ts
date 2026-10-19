import { axiosInstance } from '../lib/axios';
import { toDomainError } from '../lib/api-error';
import {
  ChecklistItemListResponseSchema,
  DailyChecklistDetailResponseSchema,
  DailyChecklistListResponseSchema,
  type ChecklistItem,
  type ChecklistStatus,
  type DailyChecklistDetail,
  type DailyChecklistSummary,
} from '../types/daily-checklist';

/**
 * Lecturas del checklist diario. El envío va por la cola de escrituras:
 * `dailyChecklist.submit` en `offline/endpoints/`.
 */
export const DailyChecklistAPI = {
  async items(): Promise<ChecklistItem[]> {
    try {
      const response = await axiosInstance.get('/api/daily-checklists/items');
      return ChecklistItemListResponseSchema.parse(response.data).data;
    } catch (error: unknown) {
      throw toDomainError(error, 'No se pudo cargar la lista del checklist.');
    }
  },

  /** `status`: p. ej. `['SUBMITTED']` para los pendientes del supervisor. */
  async list(filtro: {
    date?: string;
    equipmentId?: string;
    status?: readonly ChecklistStatus[];
  }): Promise<DailyChecklistSummary[]> {
    try {
      const response = await axiosInstance.get('/api/daily-checklists', {
        params: {
          ...(filtro.date ? { date: filtro.date } : {}),
          ...(filtro.equipmentId ? { equipmentId: filtro.equipmentId } : {}),
          ...(filtro.status?.length ? { status: filtro.status.join(',') } : {}),
        },
      });
      return DailyChecklistListResponseSchema.parse(response.data).data;
    } catch (error: unknown) {
      throw toDomainError(error, 'No se pudieron cargar los checklists enviados.');
    }
  },

  async get(id: string): Promise<DailyChecklistDetail> {
    try {
      const response = await axiosInstance.get(`/api/daily-checklists/${id}`);
      return DailyChecklistDetailResponseSchema.parse(response.data).data;
    } catch (error: unknown) {
      throw toDomainError(error, 'No se pudo cargar el checklist.');
    }
  },
};
