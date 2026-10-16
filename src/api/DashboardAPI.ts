import { axiosInstance as api } from '../lib/axios';
import { toDomainError } from '../lib/api-error';
import type { ApiResponse } from '../types/api';
import {
  MantenedoresSchema,
  MetricasEquipoSchema,
  ResumenHoySchema,
  SupervisoresSchema,
  VueltasSchema,
  type Mantenedores,
  type MetricasEquipo,
  type RangoDashboard,
  type ResumenHoy,
  type Supervisores,
  type Vueltas,
} from '../types/dashboard';

// ---------------------------------------------------------------------------
// Dashboard administrador — endpoints reales de smi-backend (`/api/dashboard/*`,
// solo rol ADMIN). Lectura pura: sin outbox, sin mutaciones.
// ---------------------------------------------------------------------------

export async function getDashboardHoy(): Promise<ResumenHoy> {
  try {
    const res = await api.get<ApiResponse<ResumenHoy>>('/api/dashboard/hoy');
    return ResumenHoySchema.parse(res.data.data);
  } catch (error: unknown) {
    throw toDomainError(error, 'No se pudo cargar el resumen de hoy.');
  }
}

export async function getDashboardEquipos(rango: RangoDashboard): Promise<MetricasEquipo[]> {
  try {
    const res = await api.get<ApiResponse<MetricasEquipo[]>>('/api/dashboard/equipos', { params: rango });
    return MetricasEquipoSchema.array().parse(res.data.data);
  } catch (error: unknown) {
    throw toDomainError(error, 'No se pudieron cargar las métricas de equipos.');
  }
}

export async function getDashboardSupervisores(rango: RangoDashboard): Promise<Supervisores> {
  try {
    const res = await api.get<ApiResponse<Supervisores>>('/api/dashboard/supervisores', { params: rango });
    return SupervisoresSchema.parse(res.data.data);
  } catch (error: unknown) {
    throw toDomainError(error, 'No se pudo cargar el resumen por supervisor.');
  }
}

export async function getDashboardMantenedores(rango: RangoDashboard): Promise<Mantenedores> {
  try {
    const res = await api.get<ApiResponse<Mantenedores>>('/api/dashboard/mantenedores', { params: rango });
    return MantenedoresSchema.parse(res.data.data);
  } catch (error: unknown) {
    throw toDomainError(error, 'No se pudo cargar el resumen de mantenedores.');
  }
}

export async function getDashboardVueltas(rango: RangoDashboard): Promise<Vueltas> {
  try {
    const res = await api.get<ApiResponse<Vueltas>>('/api/dashboard/vueltas', { params: rango });
    return VueltasSchema.parse(res.data.data);
  } catch (error: unknown) {
    throw toDomainError(error, 'No se pudieron cargar las vueltas.');
  }
}
