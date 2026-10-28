/**
 * Suscripción Web Push de ESTE dispositivo. Habla con el navegador
 * (Notification/PushManager, vía el SW que registra `ReloadPrompt.tsx`) y con
 * el backend (`api/PushAPI.ts`); la marca de opt-in por usuario vive en
 * `push-optin.ts`.
 *
 * Ciclo de vida (diseño en docs del proyecto):
 * - `enablePush`/`disablePush`: el toggle de `PushToggleCard` — el único lugar
 *   donde se pide el permiso del sistema (requiere gesto del usuario en iOS).
 * - `unsubscribePushOnLogout`: tablets compartidas — el dispositivo deja de
 *   recibir push del usuario saliente, pero CONSERVA su marca de opt-in.
 * - `resubscribeIfOptedIn`: al montar una sesión confirmada
 *   (`PushResubscribeMount`) — resuscribe en silencio a quien ya había
 *   activado el push en este dispositivo.
 */
import { PushAPI } from '../api/PushAPI';
import type { PushSubscriptionInput } from '../types/push';
import { clearPushOptIn, readPushOptIn, savePushOptIn } from './push-optin';

export type PushDeviceStatus =
  | 'unsupported'
  | 'denied'
  | 'unsubscribed'
  | 'subscribed';

export function isPushSupported(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    'serviceWorker' in navigator &&
    typeof window !== 'undefined' &&
    'PushManager' in window &&
    'Notification' in window
  );
}

export async function getPushDeviceStatus(): Promise<PushDeviceStatus> {
  if (!isPushSupported()) return 'unsupported';
  if (Notification.permission === 'denied') return 'denied';
  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.getSubscription();
  return subscription ? 'subscribed' : 'unsubscribed';
}

/**
 * Pide el permiso (de un gesto del usuario), suscribe el dispositivo y lo
 * registra en el backend. Devuelve `'denied'` si el usuario no concede el
 * permiso; lanza `DomainError` ante fallas de red/servidor (el caller decide
 * el toast).
 */
export async function enablePush(userId: string): Promise<PushDeviceStatus> {
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return 'denied';

  const subscription = await subscribeDevice();
  await PushAPI.subscribe(toSubscriptionInput(subscription));
  savePushOptIn(userId);
  return 'subscribed';
}

/** Apagado explícito y persistente: borra la marca, así el próximo login NO
 * resuscribe (a diferencia del logout). */
export async function disablePush(userId: string): Promise<void> {
  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.getSubscription();
  if (subscription) {
    const endpoint = subscription.endpoint;
    await subscription.unsubscribe();
    await PushAPI.unsubscribe(endpoint);
  }
  clearPushOptIn(userId);
}

/**
 * Resuscripción silenciosa al montar sesión: solo si este usuario ya activó
 * el push en este dispositivo Y el permiso sigue concedido. Nunca muestra un
 * prompt ni lanza — si falla (sin red, backend caído), el próximo montaje
 * vuelve a intentar. Siempre re-postea: el upsert del backend es idempotente
 * y reasigna el endpoint a quien está logueado.
 */
export async function resubscribeIfOptedIn(userId: string): Promise<void> {
  try {
    if (!isPushSupported()) return;
    if (!readPushOptIn(userId)) return;
    if (Notification.permission !== 'granted') return;

    const subscription = await subscribeDevice();
    await PushAPI.subscribe(toSubscriptionInput(subscription));
  } catch {
    // Best-effort: sin red o backend caído, se reintenta en el próximo login.
  }
}

/**
 * Best-effort al cerrar sesión (lo llama `lib/logout.ts` ANTES de invalidar
 * la cookie: el DELETE necesita la sesión viva). Conserva la marca de opt-in
 * para que el re-login resuscriba solo. Si falla (sin señal), la suscripción
 * huérfana la limpia el backend con el primer push rechazado (404/410) o la
 * reasigna el próximo usuario del dispositivo.
 */
export async function unsubscribePushOnLogout(): Promise<void> {
  try {
    if (!isPushSupported()) return;
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    if (!subscription) return;

    const endpoint = subscription.endpoint;
    await PushAPI.unsubscribe(endpoint);
    await subscription.unsubscribe();
  } catch {
    // El logout sigue igual: esto es limpieza, no un requisito.
  }
}

/** Reusa la suscripción vigente del navegador o crea una nueva con la clave
 * pública del servidor. */
async function subscribeDevice(): Promise<PushSubscription> {
  const registration = await navigator.serviceWorker.ready;
  const existing = await registration.pushManager.getSubscription();
  if (existing) return existing;

  const publicKey = await PushAPI.vapidPublicKey();
  if (!publicKey) {
    throw new Error(
      'Las notificaciones push no están configuradas en el servidor.',
    );
  }
  return registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(publicKey),
  });
}

function toSubscriptionInput(
  subscription: PushSubscription,
): PushSubscriptionInput {
  const json = subscription.toJSON();
  if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
    throw new Error('La suscripción del navegador vino incompleta.');
  }
  return {
    endpoint: json.endpoint,
    keys: { p256dh: json.keys.p256dh, auth: json.keys.auth },
    userAgent: navigator.userAgent,
  };
}

/** La Push API exige la clave VAPID como bytes; el backend la entrega en
 * base64url (formato de `web-push generate-vapid-keys`). El `ArrayBuffer`
 * explícito tipa el resultado como `Uint8Array<ArrayBuffer>` — lo que exige
 * `applicationServerKey` (BufferSource) desde TS 5.7. */
function urlBase64ToUint8Array(base64Url: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64Url.length % 4)) % 4);
  const base64 = (base64Url + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const bytes = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i += 1) {
    bytes[i] = raw.charCodeAt(i);
  }
  return bytes;
}
