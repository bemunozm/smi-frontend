import { toDomainError } from '../lib/api-error';
import {
  DashboardSummaryResponseSchema,
  MantencionesProximasResponseSchema,
  type DashboardSummary,
  type MantencionProxima,
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
 * `hooks/useEquipos.ts#useResumenFlota` / `hooks/useInventario.ts#useResumenInventario`
 * respectivamente). Cada campo documenta su contrato real (ver también
 * `types/dashboard.ts` y `DASHBOARD-CONTRACTS.md` en la raíz del proyecto):
 *
 * TODO(integración): `proximasMantenciones` ← Mantenimiento (Joaquín):
 *   motor preventivo por umbral de horómetro — Fase 2, no existe aún.
 * TODO(integración): `cumplimientoPreventivoPct` ← Mantenimiento (Joaquín):
 *   % de mantenciones preventivas ejecutadas dentro del umbral de horómetro
 *   — Fase 2, no existe aún.
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
 * (Mantenimiento, Joaquín) cuando exista — Fase 2.
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

export const DashboardAPI = {
  getSummary,
  getMantencionesProximas,
};
