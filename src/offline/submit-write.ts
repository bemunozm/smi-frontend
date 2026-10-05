import type { HttpWriteSpec } from './outbox';
import { discardOp, enqueueHttpWrite } from './outbox';
import { ENDPOINTS, type EndpointBody, type EndpointKey, type EndpointParams, type EndpointResult } from './endpoints';
import { getCurrentUserId, requestSync, waitForOutcome } from './replay';
import { DomainError } from '../lib/api-error';
import type { QueryKeyName } from '../lib/query-keys';
import { generateUuid } from '../lib/uuid';
import type { JsonObject } from '../types/json';

export interface SubmitWriteInput<K extends EndpointKey> {
  params: EndpointParams<K>;
  /** Solo lo que cambió, en un PATCH. */
  body: EndpointBody<K>;
  /** Valor base de cada campo tocado (precondición `X-Expected`). */
  expected?: JsonObject;
  files?: HttpWriteSpec['files'];
  entityKey?: string;
  dependsOn?: string[];
  invalidate?: QueryKeyName[];
}

export interface SubmitWriteOptions {
  /** Cuánto esperar el resultado del replay. `0` = devolver `queued` ya
   * (Terreno); oficina espera unos segundos para poder mostrar el error de
   * negocio en el formulario. */
  waitMs: number;
  /** A nombre de quién se encola. Por defecto, el usuario de la sesión del
   * motor (`setCurrentUser`); los hooks pasan el suyo, igual que los `enqueue*`. */
  userId?: string;
}

/** Cuánto espera oficina el resultado antes de dar la escritura por guardada en
 * el equipo (`queued`): lo bastante para mostrar un error de negocio en el
 * formulario, sin dejar a la persona mirando un spinner con mala señal. */
export const OFFICE_WAIT_MS = 8_000;

/** `opId` es el id de la operación en el outbox: sirve para encadenar lo
 * siguiente (`dependsOn`) cuando la escritura quedó esperando. */
export type SubmitWriteResult<K extends EndpointKey> =
  /** `data` es `null` si el servidor no devolvió un cuerpo que calce (la
   * escritura igual se aplicó). */
  | { status: 'sent'; data: EndpointResult<K> | null; opId: string }
  | { status: 'queued'; opId: string };

/**
 * Único camino de escritura encolable: SIEMPRE guarda en el outbox y pide la
 * sincronización; el replay es el único que habla con el servidor (FIFO por
 * `seq`). Después espera hasta `waitMs` el resultado de ESA operación:
 * - enviada → `{ status: 'sent', data }`;
 * - error de negocio mientras se espera → se borra la operación (con lo que
 *   dependa de ella) y se lanza un `DomainError`, para que el formulario lo
 *   muestre en vez de dejar un registro rechazado esperando en la hoja de
 *   sincronización;
 * - sin señal, tiempo agotado o error transitorio → `{ status: 'queued' }`.
 *
 * Lo que se encole sobre una entidad cuya creación sigue en la cola queda detrás
 * de ella sin que el llamador lo pida (ver `offline/outbox.ts#enqueueHttpWrite`);
 * `dependsOn` sirve para encadenar entre entidades distintas con el `opId`.
 */
export async function submitWrite<K extends EndpointKey>(
  endpoint: K,
  input: SubmitWriteInput<K>,
  options: SubmitWriteOptions,
): Promise<SubmitWriteResult<K>> {
  const userId = options.userId ?? getCurrentUserId();
  if (!userId) throw new DomainError('No hay una sesión activa. Iniciá sesión para guardar.');

  const def = ENDPOINTS[endpoint];
  const params: Record<string, string> = { ...input.params };
  const body: JsonObject = { ...input.body };
  const id = generateUuid();
  // Se registra ANTES de encolar: el resultado no puede llegar antes que quien lo espera.
  const waiter = options.waitMs > 0 ? waitForOutcome(id, options.waitMs) : null;

  try {
    await enqueueHttpWrite(userId, {
      id,
      endpoint,
      params,
      body,
      expected: input.expected,
      files: input.files,
      entityKey: input.entityKey,
      dependsOn: input.dependsOn,
      label: def.label(params, body),
      invalidate: input.invalidate,
    });
  } catch (error: unknown) {
    waiter?.cancel();
    throw error;
  }
  requestSync();
  if (!waiter) return { status: 'queued', opId: id };

  const outcome = await waiter.promise;
  if (outcome.kind === 'business') {
    await discardOp(id, userId);
    throw outcome.error;
  }
  if (outcome.kind === 'sent') return { status: 'sent', data: def.parse(outcome.data), opId: id };
  return { status: 'queued', opId: id };
}
