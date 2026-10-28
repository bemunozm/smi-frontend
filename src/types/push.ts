import { z } from 'zod';

/**
 * Respuestas de `smi-backend` para las suscripciones Web Push
 * (`PushController`): envelope `{ data, message }` como el resto de la API.
 */

/** `GET /api/push/vapid-public-key` — `publicKey: null` = push deshabilitado
 * en ese ambiente (sin claves VAPID configuradas). */
export const VapidPublicKeyResponseSchema = z.object({
  data: z.object({ publicKey: z.string().nullable() }),
  message: z.string(),
});

/** `POST`/`DELETE /api/push/subscriptions` — mutaciones sin payload de vuelta. */
export const PushMutationResponseSchema = z.object({
  data: z.null(),
  message: z.string(),
});

/** Body del `POST /api/push/subscriptions` — el shape que entrega
 * `PushSubscription.toJSON()` del navegador, más el user agent para poder
 * reconocer el dispositivo. */
export interface PushSubscriptionInput {
  endpoint: string;
  keys: { p256dh: string; auth: string };
  userAgent?: string;
}
