import { logger } from '../lib/logger';

/**
 * Comunicación entre pestañas de la app (la PWA instalada y una pestaña de
 * Safari, o dos pestañas del navegador). El replay corre en UNA sola pestaña por
 * vez (candado de `navigator.locks`), pero quien espera el resultado de un
 * guardado puede estar en OTRA: sin este canal ese guardado se quedaba como
 * "guardado en el equipo" y el error de negocio no llegaba al formulario.
 */

/** Resultado de una operación en una forma que viaja por `BroadcastChannel`. */
export type SharedOutcome =
  | { kind: 'sent'; data: unknown }
  | { kind: 'business'; message: string; code?: string; status?: number };

type CrossTabMessage = { type: 'outcome'; opId: string; outcome: SharedOutcome } | { type: 'sync-requested' };

export interface CrossTabHandlers {
  /** Otra pestaña terminó una operación cuyo resultado esta pestaña puede estar esperando. */
  onOutcome: (opId: string, outcome: SharedOutcome) => void;
  /** Otra pestaña no pudo sincronizar porque esta tiene el candado: que corra otra vez al terminar. */
  onSyncRequested: () => void;
}

const CHANNEL_NAME = 'smi-outbox';

let channel: BroadcastChannel | null = null;
let handlers: CrossTabHandlers | null = null;

function isMessage(value: unknown): value is CrossTabMessage {
  if (typeof value !== 'object' || value === null || !('type' in value)) return false;
  return value.type === 'outcome' || value.type === 'sync-requested';
}

/** Abre el canal (una vez) y engancha a quien escucha. Sin `BroadcastChannel`
 * (navegador viejo) no hace nada: cada pestaña sigue resolviendo lo suyo. */
export function listenCrossTab(next: CrossTabHandlers): void {
  handlers = next;
  if (channel || typeof BroadcastChannel === 'undefined') return;
  channel = new BroadcastChannel(CHANNEL_NAME);
  channel.onmessage = (event: MessageEvent<unknown>) => {
    const message = event.data;
    if (!isMessage(message)) return;
    if (message.type === 'outcome') handlers?.onOutcome(message.opId, message.outcome);
    else handlers?.onSyncRequested();
  };
}

function post(message: CrossTabMessage): void {
  try {
    channel?.postMessage(message);
  } catch (error) {
    logger.error('No se pudo avisar a las otras pestañas.', error);
  }
}

/** Avisa a las otras pestañas cómo terminó una operación. */
export function publishOutcome(opId: string, outcome: SharedOutcome): void {
  post({ type: 'outcome', opId, outcome });
}

/** Pide a la pestaña que tiene el candado de sincronización que corra otra vez. */
export function requestRemoteSync(): void {
  post({ type: 'sync-requested' });
}

/** Cierra el canal — para los tests y para no dejar un recurso abierto entre ellos. */
export function closeCrossTab(): void {
  channel?.close();
  channel = null;
  handlers = null;
}
