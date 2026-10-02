import { useQuery } from '@tanstack/react-query';

import { ShiftCardAPI } from '../api/ShiftCardAPI';
import { SHIFT_CARDS_MINE_KEY } from '../lib/query-keys';

/**
 * Tarjetas propias del Módulo A — SIN filtros en la key: es la misma URL
 * estable (`GET /api/shift-cards/mine`) que expone el backend, cacheada
 * offline (Workbox `smi-api`, ver `vite.config.ts`) para el arranque en
 * frío sin señal (RFC "Supervisión en Terreno" §Diseño → Offline).
 */
export function useShiftCardsMine() {
  return useQuery({
    queryKey: SHIFT_CARDS_MINE_KEY,
    queryFn: ShiftCardAPI.listMine,
  });
}
