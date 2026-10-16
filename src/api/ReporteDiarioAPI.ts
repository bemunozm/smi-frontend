import { axiosInstance as api } from '../lib/axios';
import { toDomainError } from '../lib/api-error';
import type { ApiResponse } from '../types/api';
import type { EntradaCambios } from '../types/cambios';
import type {
  EmpresaExterna,
  Planta,
  ReporteDiario,
} from '../types/reporte-diario';

export interface ListReportesParams {
  desde?: string;
  hasta?: string;
  turno?: 'DIURNO' | 'NOCTURNO';
}

export async function listReportesDiarios(
  params?: ListReportesParams,
): Promise<ReporteDiario[]> {
  const res = await api.get<ApiResponse<ReporteDiario[]>>(
    '/api/reporte-diario',
    { params },
  );
  return res.data.data;
}

export async function getReporteDiario(id: string): Promise<ReporteDiario> {
  const res = await api.get<ApiResponse<ReporteDiario>>(
    `/api/reporte-diario/${id}`,
  );
  return res.data.data;
}

/** Quién cambió qué de un reporte, del más reciente al más viejo. */
export async function listCambiosReporteDiario(
  id: string,
): Promise<EntradaCambios[]> {
  try {
    const res = await api.get<ApiResponse<EntradaCambios[]>>(
      `/api/reporte-diario/${id}/changes`,
    );
    return res.data.data;
  } catch (error) {
    throw toDomainError(error, 'No se pudo cargar el historial de cambios.');
  }
}

export async function listPlantas(): Promise<Planta[]> {
  const res = await api.get<ApiResponse<Planta[]>>('/api/plantas');
  return res.data.data;
}

export async function listEmpresasExternas(): Promise<EmpresaExterna[]> {
  const res = await api.get<ApiResponse<EmpresaExterna[]>>(
    '/api/empresas-externas',
  );
  return res.data.data;
}
