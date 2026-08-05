import { toDomainError } from '../lib/api-error';
import {
  DashboardSummaryResponseSchema,
  FlotaComposicionResponseSchema,
  HallazgosRecientesResponseSchema,
  HallazgosTendenciaResponseSchema,
  InsumosBajoStockResponseSchema,
  MantencionesProximasResponseSchema,
  TrabajosExtraordinariosResponseSchema,
  type DashboardSummary,
  type FlotaComposicionItem,
  type HallazgoResumen,
  type HallazgoTendenciaSemana,
  type InsumoBajoStock,
  type MantencionProxima,
  type TrabajoExtraordinarioMes,
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
 * TODO(integración): `hallazgosAbiertosPorCriticidad` ← Terreno (Alexander):
 *   mismo endpoint que `hallazgosAbiertos`, agrupado por `criticidad` en vez
 *   de solo contar.
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
        hallazgosAbiertos: 5,
        hallazgosAbiertosPorCriticidad: { critica: 1, alta: 2, media: 1, baja: 1 },
        proximasMantenciones: 3,
        ingresosTrabajosExtra: 2_450_000,
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
 * TODO(integración): reemplazar por `GET /api/hallazgos` agregado por
 * semana (`fecha`) y `estado`, abiertos vs cerrados. Dominio: Terreno
 * (Alexander). El endpoint actual no soporta agregación temporal — habría
 * que pedirla o calcularla en cliente sobre el listado completo.
 */
async function getHallazgosTendencia(): Promise<HallazgoTendenciaSemana[]> {
  try {
    await delay(300);

    const mockResponse = {
      data: [
        { semana: '30 jun', abiertos: 4, cerrados: 2 },
        { semana: '7 jul', abiertos: 3, cerrados: 3 },
        { semana: '14 jul', abiertos: 5, cerrados: 3 },
        { semana: '21 jul', abiertos: 6, cerrados: 4 },
        { semana: '28 jul', abiertos: 4, cerrados: 5 },
        { semana: '4 ago', abiertos: 5, cerrados: 4 },
        { semana: '11 ago', abiertos: 3, cerrados: 6 },
        { semana: '18 ago', abiertos: 5, cerrados: 3 },
      ],
      message: 'ok (mock)',
    };

    return HallazgosTendenciaResponseSchema.parse(mockResponse).data;
  } catch (error: unknown) {
    throw toDomainError(error, 'No se pudo obtener la tendencia de hallazgos.');
  }
}

/**
 * TODO(integración): reemplazar por `GET /api/trabajos-extraordinarios`
 * agregado por mes, sumando `totalHoras`. Dominio: Terreno (Alexander). Usa
 * HORAS, no ingresos — el campo `monto` fue eliminado del modelo.
 */
async function getTrabajosExtraordinariosMensual(): Promise<TrabajoExtraordinarioMes[]> {
  try {
    await delay(300);

    const mockResponse = {
      data: [
        { mes: 'Mar', horas: 32 },
        { mes: 'Abr', horas: 41 },
        { mes: 'May', horas: 28 },
        { mes: 'Jun', horas: 53 },
        { mes: 'Jul', horas: 47 },
        { mes: 'Ago', horas: 36 },
      ],
      message: 'ok (mock)',
    };

    return TrabajosExtraordinariosResponseSchema.parse(mockResponse).data;
  } catch (error: unknown) {
    throw toDomainError(error, 'No se pudo obtener las horas extraordinarias.');
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
  getHallazgosRecientes,
  getMantencionesProximas,
  getFlotaComposicion,
  getHallazgosTendencia,
  getTrabajosExtraordinariosMensual,
  getInsumosBajoStock,
};
