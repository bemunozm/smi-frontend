import { toDomainError } from '../lib/api-error';
import {
  DashboardSummaryResponseSchema,
  FlotaComposicionResponseSchema,
  InsumosBajoStockResponseSchema,
  MantencionesProximasResponseSchema,
  type DashboardSummary,
  type FlotaComposicionItem,
  type InsumoBajoStock,
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
 * MOCK — bloque Núcleo, dominios que todavía no integraron a `main`
 * (Terreno ya lo hizo: ver `hooks/useDashboard.ts` para sus 4 piezas con
 * datos reales). Cada campo documenta su contrato real (ver también
 * `types/dashboard.ts` y `DASHBOARD-CONTRACTS.md` en la raíz del proyecto):
 *
 * TODO(integración): `equiposDisponibles` ← Flota/Inventario (Amin, endpoint
 *   no existe aún): `GET /api/equipos`, contar `estado === 'DISPONIBLE'`
 *   sobre el total. Ideal: pedir un endpoint de agregación en vez de
 *   contar en cliente sobre el listado completo.
 * TODO(integración): `proximasMantenciones` ← Mantenimiento (Joaquín):
 *   motor preventivo por umbral de horómetro — Fase 2, no existe aún.
 * TODO(integración): `cumplimientoPreventivoPct` ← Mantenimiento (Joaquín):
 *   % de mantenciones preventivas ejecutadas dentro del umbral de horómetro
 *   — Fase 2, no existe aún.
 * TODO(integración): `insumosBajoMinimo` ← Inventario/Amin: conteo de
 *   insumos con `stockActual < stockMinimo`. Endpoint no existe aún.
 */
async function getSummary(): Promise<DashboardSummary> {
  try {
    await delay(300);

    const mockResponse = {
      data: {
        equiposDisponibles: { disponibles: 12, total: 18 },
        proximasMantenciones: 3,
        cumplimientoPreventivoPct: 87,
        insumosBajoMinimo: 4,
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

/**
 * TODO(integración): reemplazar por `GET /api/equipos`, agrupado por
 * `estado` (idealmente un endpoint de agregación). Dominio: Flota/Inventario
 * (Amin). Los conteos deben sumar `equiposDisponibles.total` del summary.
 */
async function getFlotaComposicion(): Promise<FlotaComposicionItem[]> {
  try {
    await delay(300);

    const mockResponse = {
      data: [
        { estado: 'DISPONIBLE', cantidad: 12 },
        { estado: 'EN_RUTA', cantidad: 3 },
        { estado: 'EN_MANTENCION', cantidad: 2 },
        { estado: 'DE_BAJA', cantidad: 1 },
      ],
      message: 'ok (mock)',
    };

    return FlotaComposicionResponseSchema.parse(mockResponse).data;
  } catch (error: unknown) {
    throw toDomainError(error, 'No se pudo obtener la composición de la flota.');
  }
}

/**
 * TODO(integración): reemplazar por el endpoint de Inventario que filtre
 * `stockActual < stockMinimo`. Dominio: Inventario/Amin, endpoint no existe
 * aún en `main`. Mismo dato alimenta `insumosBajoMinimo` del summary.
 */
async function getInsumosBajoStock(): Promise<InsumoBajoStock[]> {
  try {
    await delay(300);

    const mockResponse = {
      data: [
        { id: 'IN-014', insumo: 'Aceite hidráulico 20L', stockActual: 2, stockMinimo: 6 },
        { id: 'IN-027', insumo: 'Filtro de aire PE-004', stockActual: 1, stockMinimo: 4 },
        { id: 'IN-033', insumo: 'Correa alternador', stockActual: 0, stockMinimo: 3 },
        { id: 'IN-041', insumo: 'Grasa multipropósito 5kg', stockActual: 3, stockMinimo: 5 },
      ],
      message: 'ok (mock)',
    };

    return InsumosBajoStockResponseSchema.parse(mockResponse).data;
  } catch (error: unknown) {
    throw toDomainError(error, 'No se pudo obtener los insumos bajo stock mínimo.');
  }
}

export const DashboardAPI = {
  getSummary,
  getMantencionesProximas,
  getFlotaComposicion,
  getInsumosBajoStock,
};
