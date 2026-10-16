import { axiosInstance as api } from '../lib/axios';
import { toDomainError } from '../lib/api-error';
import type { ApiResponse } from '../types/api';
import {
  DashboardSummaryResponseSchema,
  MantencionesProximasResponseSchema,
  MantenedoresSchema,
  MetricasEquipoSchema,
  ResumenHoySchema,
  SupervisoresSchema,
  VueltasSchema,
  type DashboardSummary,
  type Mantenedores,
  type MantencionProxima,
  type MetricasEquipo,
  type RangoDashboard,
  type ResumenHoy,
  type Supervisores,
  type Vueltas,
} from '../types/dashboard';

/**
 * Latencia artificial para que el mock ejercite los estados `isPending`
 * reales de la vista (spinner visible), igual que lo haría una llamada de
 * red de verdad. Quitar cuando `DashboardAPI` pase a pegarle al backend.
 */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * MOCK — bloque Núcleo, único dominio que todavía no integró a `main`
 * (Terreno y Flota/Inventario ya lo hicieron: ver `hooks/useDashboard.ts` y
 * `hooks/useEquipment.ts#useResumenFleet` / `hooks/useInventario.ts#useResumenInventario`
 * respectivamente). Cada campo documenta su contrato real (ver también
 * `types/dashboard.ts` y `DASHBOARD-CONTRACTS.md` en la raíz del proyecto):
 *
 * TODO(integración): `proximasMantenciones` ← Mantenimiento: motor preventivo por
 *   umbral de horómetro, todavía no existe.
 * TODO(integración): `cumplimientoPreventivoPct` ← Mantenimiento: % de
 *   mantenciones preventivas ejecutadas dentro del umbral de horómetro, todavía
 *   no existe.
 */
async function getSummary(): Promise<DashboardSummary> {
  try {
    await delay(300);

    const mockResponse = {
      data: {
        proximasMantenciones: 3,
        cumplimientoPreventivoPct: 87,
      },
      message: 'ok (mock)',
    };

    return DashboardSummaryResponseSchema.parse(mockResponse).data;
  } catch (error: unknown) {
    throw toDomainError(error, 'No se pudo obtener el resumen del dashboard.');
  }
}

/**
 * TODO(integración): reemplazar por el endpoint del motor preventivo
 * (Mantenimiento) cuando exista.
 */
async function getMantencionesProximas(): Promise<MantencionProxima[]> {
  try {
    await delay(300);

    const mockResponse = {
      data: [
        { id: 'MT-101', equipo: 'EX-001', tipo: 'PREVENTIVA', horometroRestante: 18 },
        { id: 'MT-102', equipo: 'PE-004', tipo: 'PREVENTIVA', horometroRestante: 42 },
        { id: 'MT-103', equipo: 'CM-003', tipo: 'CORRECTIVA', horometroRestante: 0 },
      ],
      message: 'ok (mock)',
    };

    return MantencionesProximasResponseSchema.parse(mockResponse).data;
  } catch (error: unknown) {
    throw toDomainError(error, 'No se pudo obtener las próximas mantenciones.');
  }
}

// TODO(Task 6-8): eliminar — mock de la vista anterior; lo sigue usando DashboardView/PreventivoView hasta Tasks 6-8.
export const DashboardAPI = {
  getSummary,
  getMantencionesProximas,
};

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
