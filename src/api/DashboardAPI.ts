import { toDomainError } from '../lib/api-error';
import {
  DashboardSummaryResponseSchema,
  HallazgosRecientesResponseSchema,
  MantencionesProximasResponseSchema,
  type DashboardSummary,
  type HallazgoResumen,
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
 * MOCK — bloque Núcleo, dominios de compañeros aún sin integrar a `main`.
 * Cada campo documenta su contrato real (ver también `types/dashboard.ts`
 * y `DASHBOARD-CONTRACTS.md` en la raíz del proyecto):
 *
 * TODO(integración): `equiposDisponibles` ← Flota/Inventario (Amin, endpoint
 *   no existe aún): `GET /api/equipos`, contar `estado === 'DISPONIBLE'`
 *   sobre el total. Ideal: pedir un endpoint de agregación en vez de
 *   contar en cliente sobre el listado completo.
 * TODO(integración): `hallazgosAbiertos` ← Terreno (Alexander):
 *   `GET /api/hallazgos?estado=ABIERTO` → `data.length`. Hoy no hay
 *   filtro/agregación por estado; si no lo agregan, contar en cliente.
 * TODO(integración): `proximasMantenciones` ← Mantenimiento (Joaquín):
 *   motor preventivo por umbral de horómetro — Fase 2, no existe aún.
 * TODO(integración): `ingresosTrabajosExtra` ← Terreno: suma de `monto`
 *   sobre `TrabajoExtraordinario`. El campo `monto` fue ELIMINADO del
 *   modelo — pendiente reponerlo con Alexander. Sujeto a confirmación.
 */
async function getSummary(): Promise<DashboardSummary> {
  try {
    await delay(300);

    const mockResponse = {
      data: {
        equiposDisponibles: { disponibles: 12, total: 18 },
        hallazgosAbiertos: 5,
        proximasMantenciones: 3,
        ingresosTrabajosExtra: 2_450_000,
      },
      message: 'ok (mock)',
    };

    return DashboardSummaryResponseSchema.parse(mockResponse).data;
  } catch (error: unknown) {
    throw toDomainError(error, 'No se pudo obtener el resumen del dashboard.');
  }
}

/**
 * TODO(integración): reemplazar por `GET /api/hallazgos?estado=ABIERTO&limit=5`
 * (orden por fecha desc). Dominio: Terreno (Alexander).
 */
async function getHallazgosRecientes(): Promise<HallazgoResumen[]> {
  try {
    await delay(300);

    const mockResponse = {
      data: [
        {
          id: 'HZ-004',
          equipo: 'PE-004',
          descripcion: 'Fuga de aceite hidráulico en cilindro de levante',
          criticidad: 'ALTA',
          estado: 'ABIERTO',
          fecha: '2026-08-04T08:12:00.000Z',
        },
        {
          id: 'HZ-003',
          equipo: 'EX-001',
          descripcion: 'Ruido anormal en motor al acelerar en vacío',
          criticidad: 'MEDIA',
          estado: 'EN_PROCESO',
          fecha: '2026-08-04T07:40:00.000Z',
        },
        {
          id: 'HZ-002',
          equipo: 'CM-003',
          descripcion: 'Frenos con baja respuesta — equipo fuera de servicio',
          criticidad: 'CRITICA',
          estado: 'ABIERTO',
          fecha: '2026-08-04T06:55:00.000Z',
        },
        {
          id: 'HZ-001',
          equipo: 'CG-002',
          descripcion: 'Desgaste irregular en neumático delantero derecho',
          criticidad: 'BAJA',
          estado: 'CERRADO',
          fecha: '2026-08-03T17:20:00.000Z',
        },
      ],
      message: 'ok (mock)',
    };

    return HallazgosRecientesResponseSchema.parse(mockResponse).data;
  } catch (error: unknown) {
    throw toDomainError(error, 'No se pudo obtener los hallazgos recientes.');
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
  getHallazgosRecientes,
  getMantencionesProximas,
};
