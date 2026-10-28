import { axiosInstance } from '../lib/axios';
import { toDomainError } from '../lib/api-error';
import {
  PushMutationResponseSchema,
  VapidPublicKeyResponseSchema,
  type PushSubscriptionInput,
} from '../types/push';

/**
 * Calca `api/NotificacionAPI.ts`: axios + try/catch + validación Zod de la
 * respuesta completa + retorno del `.data` tipado. Consumida por
 * `lib/push-device.ts` (suscripción del dispositivo), no por hooks de
 * TanStack Query: el estado de push es del navegador, no del servidor.
 */
async function vapidPublicKey(): Promise<string | null> {
  try {
    const response = await axiosInstance.get('/api/push/vapid-public-key');
    return VapidPublicKeyResponseSchema.parse(response.data).data.publicKey;
  } catch (error: unknown) {
    throw toDomainError(error, 'No se pudo obtener la clave de notificaciones push.');
  }
}

async function subscribe(input: PushSubscriptionInput): Promise<void> {
  try {
    const response = await axiosInstance.post('/api/push/subscriptions', input);
    PushMutationResponseSchema.parse(response.data);
  } catch (error: unknown) {
    throw toDomainError(error, 'No se pudo suscribir este dispositivo a las notificaciones.');
  }
}

async function unsubscribe(endpoint: string): Promise<void> {
  try {
    const response = await axiosInstance.delete('/api/push/subscriptions', {
      data: { endpoint },
    });
    PushMutationResponseSchema.parse(response.data);
  } catch (error: unknown) {
    throw toDomainError(error, 'No se pudo desuscribir este dispositivo de las notificaciones.');
  }
}

export const PushAPI = {
  vapidPublicKey,
  subscribe,
  unsubscribe,
};
