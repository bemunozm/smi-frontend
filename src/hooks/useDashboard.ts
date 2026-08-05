import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';

import { DashboardAPI } from '../api/DashboardAPI';
import { useHallazgosList } from './useHallazgos';
import { useTrabajosExtraList } from './useTrabajosExtra';
import {
  countHallazgosAbiertos,
  hallazgosAbiertosPorPrioridad,
  hallazgosRecientes,
  hallazgosTendenciaSemanal,
  sumHorasExtra,
  trabajosExtraPorMes,
} from '../config/dashboard-aggregations';

/**
 * Solo lectura — el dashboard no tiene mutaciones, así que no hay feedback
 * de toasts que centralizar acá (a diferencia de `hooks/useUsers.ts`).
 *
 * Terreno (Alexander) ya está integrado a `main` con datos reales: los
 * hooks de sus 4 piezas (`useHallazgosAbiertosResumen`,
 * `useHallazgosRecientes`, `useHallazgosTendencia`,
 * `useTrabajosExtraordinariosMensual`) NO llaman a `DashboardAPI` — envuelven
 * `useHallazgosList()`/`useTrabajosExtraList()` (las queries reales de la
 * capa de Terreno, ver `hooks/useHallazgos.ts` / `hooks/useTrabajosExtra.ts`)
 * y derivan el shape que consume `DashboardView` con las funciones puras de
 * `config/dashboard-aggregations.ts`. Como comparten `queryKey`
 * (`['hallazgos']` / `['trabajos-extra']`) con TanStack Query, aunque varias
 * piezas del dashboard los usen a la vez solo hay una petición de red por
 * dominio — y si esa petición falla, cada pieza lo refleja en su propio
 * `isError` sin tumbar el resto del dashboard (que sigue en mock).
 */
export function useDashboardSummary() {
  return useQuery({
    queryKey: ['dashboard', 'summary'],
    queryFn: DashboardAPI.getSummary,
  });
}

/** ← Terreno (real): cuenta `estado === 'ABIERTO'` sobre `GET /api/hallazgos`
 * y desglosa por `prioridad` para el subtítulo de la card. */
export function useHallazgosAbiertosResumen() {
  const query = useHallazgosList();
  const data = useMemo(() => {
    if (!query.data) return undefined;
    return {
      abiertos: countHallazgosAbiertos(query.data),
      porPrioridad: hallazgosAbiertosPorPrioridad(query.data),
    };
  }, [query.data]);
  return { ...query, data };
}

/** ← Terreno (real): top 5 de `GET /api/hallazgos` (ya viene orden por fecha desc). */
export function useHallazgosRecientes() {
  const query = useHallazgosList();
  const data = useMemo(() => (query.data ? hallazgosRecientes(query.data) : undefined), [query.data]);
  return { ...query, data };
}

export function useMantencionesProximas() {
  return useQuery({
    queryKey: ['dashboard', 'mantenciones-proximas'],
    queryFn: DashboardAPI.getMantencionesProximas,
  });
}

export function useFlotaComposicion() {
  return useQuery({
    queryKey: ['dashboard', 'flota-composicion'],
    queryFn: DashboardAPI.getFlotaComposicion,
  });
}

/** ← Terreno (real): agrupa `GET /api/hallazgos` por semana de reporte,
 * abiertos vs cerrados — semántica documentada en
 * `config/dashboard-aggregations.ts#hallazgosTendenciaSemanal`. */
export function useHallazgosTendencia() {
  const query = useHallazgosList();
  const data = useMemo(() => (query.data ? hallazgosTendenciaSemanal(query.data) : undefined), [query.data]);
  return { ...query, data };
}

/** ← Terreno (real): agrupa `GET /api/trabajos-extra` por mes, sumando `totalHoras`. */
export function useTrabajosExtraordinariosMensual() {
  const query = useTrabajosExtraList();
  const data = useMemo(() => (query.data ? trabajosExtraPorMes(query.data) : undefined), [query.data]);
  return { ...query, data };
}

/** ← Terreno (real): KPI "Horas facturables" — total de los mismos 6 meses
 * que ya grafica "Horas extraordinarias por mes". Se apoya en
 * `useTrabajosExtraordinariosMensual()` (no en `useTrabajosExtraList()`
 * directo): reutiliza tanto la query real como los buckets mensuales ya
 * calculados, así la card y el gráfico nunca pueden desincronizarse. */
export function useHorasFacturables() {
  const query = useTrabajosExtraordinariosMensual();
  const data = useMemo(() => (query.data ? sumHorasExtra(query.data) : undefined), [query.data]);
  return { ...query, data };
}

export function useInsumosBajoStock() {
  return useQuery({
    queryKey: ['dashboard', 'insumos-bajo-stock'],
    queryFn: DashboardAPI.getInsumosBajoStock,
  });
}
