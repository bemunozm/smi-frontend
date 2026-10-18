import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';

import {
  getDashboardEquipos,
  getDashboardHoy,
  getDashboardMantenedores,
  getDashboardResumenDia,
  getDashboardSupervisores,
  getDashboardVueltas,
} from '../api/DashboardAPI';
import { DASHBOARD_KEY } from '../lib/query-keys';
import type { RangoDashboard } from '../types/dashboard';
import { useHallazgosList } from './useHallazgos';
import {
  countHallazgosAbiertos,
  hallazgosAbiertosRecientes,
  hallazgosAbiertosPorPrioridad,
  hallazgosRecientes,
} from '../config/dashboard-aggregations';

/**
 * Solo lectura — el dashboard no tiene mutaciones, así que no hay feedback
 * de toasts que centralizar acá (a diferencia de `hooks/useUsers.ts`).
 *
 * Dos orígenes de datos, ambos reales:
 * - Hallazgos (KPI, recientes, tendencia): envuelven `useHallazgosList()`
 *   (`hooks/useHallazgos.ts`) y derivan el shape de la vista con las funciones
 *   puras de `config/dashboard-aggregations.ts`. Comparten `queryKey`
 *   (`['hallazgos']`), así que hay una sola petición y un fallo se refleja en
 *   el `isError` de cada pieza sin tumbar el resto.
 * - Métricas del administrador (`useDashboard*` más abajo): consultas a
 *   `/api/dashboard/*` por rango de fechas.
 *
 * Flota/Inventario/Mantención no tienen hooks acá: `DashboardView` consume
 * `useItems` (`hooks/useInventory.ts`) y `useMaintenanceStatusByEquipment`
 * (`hooks/useMaintenancePlans.ts`) directamente.
 */
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

/** ← Terreno (real): últimos 10 hallazgos ABIERTOS (popup del KPI). */
export function useHallazgosAbiertosRecientes() {
  const query = useHallazgosList();
  const data = useMemo(() => (query.data ? hallazgosAbiertosRecientes(query.data) : undefined), [query.data]);
  return { ...query, data };
}


// ---------------------------------------------------------------------------
// Dashboard administrador: queries reales de `/api/dashboard/*` (solo lectura).
// ---------------------------------------------------------------------------

/** El semáforo de HOY refresca solo: es la franja viva del dashboard. */
export function useDashboardHoy() {
  return useQuery({
    queryKey: [...DASHBOARD_KEY, 'hoy'],
    queryFn: getDashboardHoy,
    staleTime: 60_000,
    refetchInterval: 5 * 60_000,
  });
}

export function useDashboardEquipos(rango: RangoDashboard) {
  return useQuery({
    queryKey: [...DASHBOARD_KEY, 'equipos', rango],
    queryFn: () => getDashboardEquipos(rango),
  });
}

export function useDashboardSupervisores(rango: RangoDashboard) {
  return useQuery({
    queryKey: [...DASHBOARD_KEY, 'supervisores', rango],
    queryFn: () => getDashboardSupervisores(rango),
  });
}

export function useDashboardMantenedores(rango: RangoDashboard) {
  return useQuery({
    queryKey: [...DASHBOARD_KEY, 'mantenedores', rango],
    queryFn: () => getDashboardMantenedores(rango),
  });
}

export function useDashboardVueltas(rango: RangoDashboard) {
  return useQuery({
    queryKey: [...DASHBOARD_KEY, 'vueltas', rango],
    queryFn: () => getDashboardVueltas(rango),
  });
}

/** Portada del admin: resumen del día. Hoy (sin `fecha`) refresca solo; un día pasado es estático. */
export function useDashboardResumenDia(fecha?: string) {
  return useQuery({
    queryKey: [...DASHBOARD_KEY, 'resumen-dia', fecha ?? 'hoy'],
    queryFn: () => getDashboardResumenDia(fecha),
    staleTime: 60_000,
    refetchInterval: fecha ? false : 5 * 60_000,
  });
}
