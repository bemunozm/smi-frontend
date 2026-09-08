import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from '@heroui/react';

import { NotificacionAPI } from '../api/NotificacionAPI';

const NOTIFICACIONES_QUERY_KEY = ['notificaciones'] as const;
const UNREAD_COUNT_QUERY_KEY = ['notificaciones', 'unread'] as const;

/** Polling cada 30s: no hay push/websocket de notificaciones todavía. */
const POLL_INTERVAL_MS = 30_000;

export function useNotificaciones() {
  return useQuery({
    queryKey: NOTIFICACIONES_QUERY_KEY,
    queryFn: NotificacionAPI.list,
    refetchInterval: POLL_INTERVAL_MS,
  });
}

export function useUnreadCount() {
  return useQuery({
    queryKey: UNREAD_COUNT_QUERY_KEY,
    queryFn: NotificacionAPI.unreadCount,
    refetchInterval: POLL_INTERVAL_MS,
  });
}

/**
 * Feedback centralizado en el hook, como `useUsers.ts`. Marcar UNA
 * notificación como leída es una acción silenciosa y frecuente — sin
 * `toast.success` (sería ruido); solo invalida ambas queries para que la
 * campana/lista se actualicen.
 */
export function useMarkRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => NotificacionAPI.markRead(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: NOTIFICACIONES_QUERY_KEY });
      void queryClient.invalidateQueries({ queryKey: UNREAD_COUNT_QUERY_KEY });
    },
    onError: (error: unknown) => {
      toast.danger(
        error instanceof Error ? error.message : 'No se pudo marcar la notificación como leída.',
      );
    },
  });
}

/** Marcar TODAS como leídas sí es una acción explícita del usuario → confirma con toast. */
export function useMarkAllRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => NotificacionAPI.markAllRead(),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: NOTIFICACIONES_QUERY_KEY });
      void queryClient.invalidateQueries({ queryKey: UNREAD_COUNT_QUERY_KEY });
      toast.success('Notificaciones marcadas como leídas');
    },
    onError: (error: unknown) => {
      toast.danger(
        error instanceof Error
          ? error.message
          : 'No se pudo marcar las notificaciones como leídas.',
      );
    },
  });
}
