import { axiosInstance } from '../lib/axios';
import { toDomainError } from '../lib/api-error';
import {
  MarkAllResponseSchema,
  MarkReadResponseSchema,
  NotificacionesResponseSchema,
  UnreadCountResponseSchema,
  type Notificacion,
} from '../types/notificacion';

/**
 * Calca `api/UserAPI.ts`: axios (`lib/axios.ts`) + try/catch + validación
 * Zod de la respuesta completa (`types/notificacion.ts`) + retorno del
 * `.data` ya tipado. Estas funciones son las `queryFn`/`mutationFn` de
 * TanStack Query (ver `hooks/useNotificaciones.ts`).
 */
async function list(): Promise<Notificacion[]> {
  try {
    const response = await axiosInstance.get('/api/notifications');
    return NotificacionesResponseSchema.parse(response.data).data;
  } catch (error: unknown) {
    throw toDomainError(error, 'No se pudo obtener la lista de notificaciones.');
  }
}

async function unreadCount(): Promise<number> {
  try {
    const response = await axiosInstance.get('/api/notifications/unread-count');
    return UnreadCountResponseSchema.parse(response.data).data.count;
  } catch (error: unknown) {
    throw toDomainError(error, 'No se pudo obtener el conteo de notificaciones no leídas.');
  }
}

async function markRead(id: string): Promise<string> {
  try {
    const response = await axiosInstance.patch(`/api/notifications/${id}/read`);
    return MarkReadResponseSchema.parse(response.data).data.id;
  } catch (error: unknown) {
    throw toDomainError(error, 'No se pudo marcar la notificación como leída.');
  }
}

async function markAllRead(): Promise<void> {
  try {
    const response = await axiosInstance.patch('/api/notifications/read-all');
    MarkAllResponseSchema.parse(response.data);
  } catch (error: unknown) {
    throw toDomainError(error, 'No se pudo marcar las notificaciones como leídas.');
  }
}

export const NotificacionAPI = {
  list,
  unreadCount,
  markRead,
  markAllRead,
};
