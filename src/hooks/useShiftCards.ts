import { useQuery } from '@tanstack/react-query';

import { ShiftCardAPI } from '../api/ShiftCardAPI';
import { SHIFT_CARDS_MINE_KEY, shiftCardCambiosKey } from '../lib/query-keys';

/**
 * Tarjetas propias del Módulo A — SIN filtros en la key: es la misma URL
 * estable (`GET /api/shift-cards/mine`) que expone el backend, cacheada
 * offline (Workbox `smi-api`, ver `vite.config.ts`) para el arranque en
 * frío sin señal.
 */
export function useShiftCardsMine() {
  return useQuery({
    queryKey: SHIFT_CARDS_MINE_KEY,
    queryFn: ShiftCardAPI.listMine,
  });
}

/** Historial de cambios de una tarjeta ya enviada. Solo con señal y con un `id`
 * que el servidor conoce (`habilitado`): una tarjeta que existe solo en el
 * equipo no tiene historial. */
export function useCambiosTarjeta(id: string | null, habilitado: boolean) {
  return useQuery({
    queryKey: shiftCardCambiosKey(id ?? ''),
    queryFn: () => ShiftCardAPI.listChanges(id!),
    enabled: id != null && habilitado,
  });
}
