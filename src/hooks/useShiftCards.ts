import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from '@heroui/react';

import { ShiftCardAPI } from '../api/ShiftCardAPI';
import {
  DASHBOARD_KEY,
  EQUIPMENT_KEY,
  HOROMETRO_KEY,
  SHIFT_CARDS_KEY,
  SHIFT_CARDS_MINE_KEY,
  shiftCardCambiosKey,
} from '../lib/query-keys';
import type { AdminCloseShiftCardInput } from '../types/shift';

export interface AdminCloseShiftCardVars {
  id: string;
  /** Solo para el toast. */
  equipoCodigo: string;
  input: AdminCloseShiftCardInput;
}

/**
 * El administrador cierra el uso en curso de un equipo (tarjeta colgada).
 * Online directo: refresca equipos (deja de figurar «En uso»), tarjetas,
 * horómetros y dashboard.
 */
export function useAdminCloseShiftCard() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: AdminCloseShiftCardVars) => ShiftCardAPI.adminCloseCard(id, input),
    onSuccess: (_data, { equipoCodigo }) => {
      for (const queryKey of [EQUIPMENT_KEY, SHIFT_CARDS_KEY, HOROMETRO_KEY, DASHBOARD_KEY]) {
        void queryClient.invalidateQueries({ queryKey });
      }
      toast.success('Uso cerrado', { description: equipoCodigo });
    },
    onError: (error: Error) => {
      toast.danger(error.message);
    },
  });
}

/**
 * Tarjetas propias del Módulo A — SIN filtros en la key: es la misma URL
 * estable (`GET /api/shift-cards/mine`) que expone el backend, cacheada
 * offline (Workbox `smi-api`, ver `vite.config.ts`) para el arranque en
 * frío sin señal.
 */
export function useShiftCardsMine(
  opciones: { refetchInterval?: number; refetchOnWindowFocus?: boolean; enabled?: boolean } = {},
) {
  return useQuery({
    queryKey: SHIFT_CARDS_MINE_KEY,
    queryFn: ShiftCardAPI.listMine,
    ...opciones,
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
