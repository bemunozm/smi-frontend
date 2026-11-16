import { axiosInstance as api } from '../lib/axios';
import { toDomainError } from '../lib/api-error';
import type { ApiResponse } from '../types/api';
import type { EntradaCambios } from '../types/cambios';
import {
  EliminarEmpresaExternaResponseSchema,
  EmpresaExternaResponseSchema,
  EmpresasExternasAdminResponseSchema,
  type EmpresaExterna,
  type EmpresaExternaAdmin,
  type Planta,
  type ReporteDiario,
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

/** Eliminación definitiva (solo ADMIN): el backend deja el resumen del
 * reporte como traza en el Registro de actividad. */
export async function deleteReporteDiario(id: string): Promise<void> {
  await api.delete(`/api/reporte-diario/${encodeURIComponent(id)}`);
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

/** Todas las empresas externas, también las desactivadas (solo ADMIN). */
export async function listEmpresasExternasAdmin(): Promise<EmpresaExternaAdmin[]> {
  try {
    const res = await api.get('/api/empresas-externas/admin');
    return EmpresasExternasAdminResponseSchema.parse(res.data).data;
  } catch (error) {
    throw toDomainError(error, 'No se pudieron cargar las empresas externas.');
  }
}

export async function createEmpresaExterna(nombre: string): Promise<EmpresaExterna> {
  try {
    const res = await api.post('/api/empresas-externas', { nombre });
    return EmpresaExternaResponseSchema.parse(res.data).data;
  } catch (error) {
    throw toDomainError(error, 'No se pudo agregar la empresa.');
  }
}

export async function updateEmpresaExterna(
  id: string,
  body: { nombre?: string; activa?: boolean },
): Promise<EmpresaExterna> {
  try {
    const res = await api.patch(`/api/empresas-externas/${encodeURIComponent(id)}`, body);
    return EmpresaExternaResponseSchema.parse(res.data).data;
  } catch (error) {
    throw toDomainError(error, 'No se pudo actualizar la empresa.');
  }
}

/** Sin reportes la borra; con reportes la desactiva (los reportes la conservan). */
export async function deleteEmpresaExterna(
  id: string,
): Promise<{ eliminada: boolean; desactivada: boolean; message: string }> {
  try {
    const res = await api.delete(`/api/empresas-externas/${encodeURIComponent(id)}`);
    const parsed = EliminarEmpresaExternaResponseSchema.parse(res.data);
    return { ...parsed.data, message: parsed.message };
  } catch (error) {
    throw toDomainError(error, 'No se pudo eliminar la empresa.');
  }
}
