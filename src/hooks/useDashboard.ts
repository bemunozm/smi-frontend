import { useQuery } from '@tanstack/react-query';

import { DashboardAPI } from '../api/DashboardAPI';

/**
 * Solo lectura — el dashboard no tiene mutaciones, así que no hay feedback
 * de toasts que centralizar acá (a diferencia de `hooks/useUsers.ts`).
 */
export function useDashboardSummary() {
  return useQuery({
    queryKey: ['dashboard', 'summary'],
    queryFn: DashboardAPI.getSummary,
  });
}

export function useHallazgosRecientes() {
  return useQuery({
    queryKey: ['dashboard', 'hallazgos-recientes'],
    queryFn: DashboardAPI.getHallazgosRecientes,
  });
}

export function useMantencionesProximas() {
  return useQuery({
    queryKey: ['dashboard', 'mantenciones-proximas'],
    queryFn: DashboardAPI.getMantencionesProximas,
  });
}
