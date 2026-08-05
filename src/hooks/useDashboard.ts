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

export function useFlotaComposicion() {
  return useQuery({
    queryKey: ['dashboard', 'flota-composicion'],
    queryFn: DashboardAPI.getFlotaComposicion,
  });
}

export function useHallazgosTendencia() {
  return useQuery({
    queryKey: ['dashboard', 'hallazgos-tendencia'],
    queryFn: DashboardAPI.getHallazgosTendencia,
  });
}

export function useTrabajosExtraordinariosMensual() {
  return useQuery({
    queryKey: ['dashboard', 'trabajos-extraordinarios-mensual'],
    queryFn: DashboardAPI.getTrabajosExtraordinariosMensual,
  });
}

export function useInsumosBajoStock() {
  return useQuery({
    queryKey: ['dashboard', 'insumos-bajo-stock'],
    queryFn: DashboardAPI.getInsumosBajoStock,
  });
}
