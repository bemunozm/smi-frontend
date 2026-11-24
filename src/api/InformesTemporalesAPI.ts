import { axiosInstance as api } from '../lib/axios';
import { toDomainError } from '../lib/api-error';
import { EntradaCambiosListResponseSchema, type EntradaCambios } from '../types/cambios';
import {
  InformeTemporalResponseSchema,
  InformesTemporalesResponseSchema,
  type InformeTemporal,
} from '../types/informe-temporal';

/**
 * Lecturas de los informes del supervisor temporal. Las escrituras (crear,
 * corregir, eliminar) van por la cola: `offline/endpoints/terreno.ts`.
 */
export const InformesTemporalesAPI = {
  /** Del más nuevo al más viejo; rango inclusivo sobre `fecha` (`YYYY-MM-DD`). */
  async listar(desde: string, hasta: string): Promise<InformeTemporal[]> {
    try {
      const res = await api.get('/api/informes-temporales', { params: { desde, hasta } });
      return InformesTemporalesResponseSchema.parse(res.data).data;
    } catch (error) {
      throw toDomainError(error, 'No se pudieron cargar los informes.');
    }
  },

  async obtener(id: string): Promise<InformeTemporal> {
    try {
      const res = await api.get(`/api/informes-temporales/${encodeURIComponent(id)}`);
      return InformeTemporalResponseSchema.parse(res.data).data;
    } catch (error) {
      throw toDomainError(error, 'No se pudo cargar el informe.');
    }
  },

  /** Quién cambió qué del informe, del más reciente al más viejo. */
  async cambios(id: string): Promise<EntradaCambios[]> {
    try {
      const res = await api.get(`/api/informes-temporales/${encodeURIComponent(id)}/changes`);
      return EntradaCambiosListResponseSchema.parse(res.data).data;
    } catch (error) {
      throw toDomainError(error, 'No se pudo cargar el historial de cambios.');
    }
  },
};
