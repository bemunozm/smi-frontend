import { useEffect } from 'react';
import { create } from 'zustand';
import type { AxiosRequestConfig } from 'axios';

import {
  bySeq,
  db,
  pendingStatusFor,
  type CloseCardOp,
  type CreateHallazgoOp,
  type HttpWriteOp,
  type OutboxLastError,
  type OutboxOp,
  type PhotoOp,
} from './db';
import { purgeApiCacheFor } from './api-cache';
import { applyCardToCache, applyHallazgoToCache, applyTrabajoExtraToCache } from './cache-upserts';
import { closeCrossTab, listenCrossTab, publishOutcome, requestRemoteSync, type SharedOutcome } from './cross-tab';
import { ENDPOINTS, isEndpointKey } from './endpoints';
import { useOtherAccountsOpCount, useOutboxOps } from './useOutboxOps';
import { ShiftCardAPI } from '../api/ShiftCardAPI';
import { ShiftReportAPI } from '../api/ShiftReportAPI';
import { createHallazgo } from '../api/HallazgosAPI';
import { createTrabajoExtra } from '../api/TrabajosExtraAPI';
import { uploadFile } from '../api/UploadsAPI';
import { sendWrite } from '../api/WriteAPI';
import { DomainError, toDomainError } from '../lib/api-error';
import { markSessionEnded } from '../lib/cache-owner';
import { mensajeErrorOperacion } from '../lib/error-messages';
import { logger } from '../lib/logger';
import { queryClient } from '../lib/query-client';
import { QUERY_KEYS, SHIFT_CARDS_MINE_KEY, type QueryKeyName } from '../lib/query-keys';
import type { ShiftCardResponse, ShiftReportResponse } from '../types/shift';

/**
 * Motor de sincronización del outbox offline. Recorre FIFO por `seq`, secuencial,
 * SOLO las operaciones del usuario de la sesión, y traduce cada resultado a uno de
 * estos destinos: enviada, `needs_attention` (error de negocio), retenida el resto
 * del run (error transitorio de esa operación), o corte del run (sin red, o 401).
 * Nunca corren dos réplicas a la vez (`navigator.locks`, con un flag de módulo
 * como respaldo).
 */

const JSON_TIMEOUT_MS = 20_000;
const UPLOAD_BASE_TIMEOUT_MS = 60_000;
const UPLOAD_TIMEOUT_PER_MB_MS = 30_000;
const UPLOAD_MAX_TIMEOUT_MS = 300_000;
const SYNC_INTERVAL_MS = 45_000;
const REPLAY_LOCK_NAME = 'smi-outbox-replay';
/** Cuántos 500/501 seguidos de UNA operación se reintentan solos antes de pedir
 * atención. Los errores de red y los de infraestructura (502/503/504, un túnel o
 * proxy caído) NO tienen tope: no hay nada roto en el registro, solo que esperar. */
const MAX_SERVER_ERROR_ATTEMPTS = 5;
/** Los únicos 5xx que dicen "el servidor falló con ESTE registro". El resto (502,
 * 503, 504, los 52x de un proxy) es que no hay un servidor al otro lado. */
const COUNTED_SERVER_STATUSES: ReadonlySet<number> = new Set([500, 501]);
/** 4xx que no son un rechazo del registro sino de la conexión: se reintentan. */
const RETRYABLE_CLIENT_STATUSES: ReadonlySet<number> = new Set([408, 425, 429]);
/** Qué se refresca al terminar un run con operaciones que no pasan por el
 * registro de endpoints (apertura/cierre de tarjeta, hallazgo, trabajo, reporte). */
const LEGACY_REFRESH: readonly QueryKeyName[] = ['shiftCardsMine', 'equipment', 'hallazgos', 'trabajosExtra'];

/** Cuánto esperar la subida de un archivo: una base más un margen por MB, con
 * tope. Una foto de cientos de KB con poca señal no cabe en el plazo de un JSON, y
 * un timeout fijo la reiniciaba desde cero en cada intento. */
export function uploadTimeoutMs(bytes: number): number {
  const megabytes = bytes / (1024 * 1024);
  return Math.min(UPLOAD_MAX_TIMEOUT_MS, Math.round(UPLOAD_BASE_TIMEOUT_MS + megabytes * UPLOAD_TIMEOUT_PER_MB_MS));
}

// --- Estado observable para la UI -------------------------------------------

interface EngineState {
  syncing: boolean;
  authRequired: boolean;
  lastSyncAt: number | null;
  lastError: OutboxLastError | null;
  /** Aviso puntual sin un lugar persistido natural (ej. "reporte enviado con
   * equipos faltantes", ver `applyReportToCache`) — `offline/` no dispara UI
   * directo (nunca importa `@heroui/react` ni llama a `toast()`, ver
   * CLAUDE.md), así que viaja como estado hasta que un componente de la UI
   * (`components/SyncEngineMount.tsx`) lo lee vía `useSyncState()`, lo
   * presenta y lo limpia con `clearEngineNotice()`. */
  notice: string | null;
}

const useEngineStore = create<EngineState>(() => ({
  syncing: false,
  authRequired: false,
  lastSyncAt: null,
  lastError: null,
  notice: null,
}));

/** Exportado SOLO para los tests del motor: inspecciona/resetea el estado entre
 * tests sin montar un componente React (el store de zustand ya expone
 * `getState`/`setState`). */
export const useEngineStoreForTests = useEngineStore;

/** Limpia el aviso puntual del motor — lo llama el componente de UI que lo
 * presentó (`components/SyncEngineMount.tsx`), justo después de mostrarlo. */
export function clearEngineNotice(): void {
  useEngineStore.setState({ notice: null });
}

export interface SyncState {
  /** Operaciones que todavía no terminaron (`pending*`/`syncing`), SIN
   * contar las `needs_attention` — esas se cuentan aparte en
   * `attentionCount` porque necesitan una acción distinta (Reintentar/
   * Descartar), no solo "esperar señal". */
  pendingCount: number;
  attentionCount: number;
  /** Registros sin enviar de OTRA cuenta que inició sesión en este equipo: no se
   * tocan, esperan a que su dueña vuelva a entrar. Solo la cantidad. */
  otherAccountCount: number;
  syncing: boolean;
  authRequired: boolean;
  lastSyncAt: number | null;
  lastError: OutboxLastError | null;
  notice: string | null;
}

/**
 * Estado combinado para la UI: el ciclo de vida del motor (`useEngineStore`,
 * arriba) + los contadores derivados EN VIVO del outbox del usuario actual
 * (`useOutboxOps`). Vive acá (no en un store aparte) porque son la misma
 * idea — "cómo va la sincronización" — y ningún otro lugar de la app
 * necesita el detalle del motor sin el contador, o viceversa.
 *
 * `userId` lo lee el LLAMADOR (`useCurrentUser()`) y lo pasa acá — `offline/`
 * no puede importar `hooks/` (regla de dependencias: `hooks/` es capa de UI,
 * `offline/` vive por debajo y la comparten componentes que no son React).
 */
export function useSyncState(userId: string | null | undefined): SyncState {
  const engine = useEngineStore();
  const ops = useOutboxOps(userId ?? undefined);
  const otherAccountCount = useOtherAccountsOpCount(userId ?? undefined);

  let pendingCount = 0;
  let attentionCount = 0;
  for (const op of ops) {
    if (op.status === 'needs_attention') attentionCount += 1;
    else pendingCount += 1;
  }

  return {
    pendingCount,
    attentionCount,
    otherAccountCount,
    syncing: engine.syncing,
    authRequired: engine.authRequired,
    lastSyncAt: engine.lastSyncAt,
    lastError: engine.lastError,
    notice: engine.notice,
  };
}

// --- Quien espera el resultado de una operación ----------------------------

/** Cómo terminó una operación para quien la está esperando (`submitWrite`). */
export type WriteOutcome =
  | { kind: 'sent'; data: unknown }
  /** El servidor la rechazó por una razón de negocio. */
  | { kind: 'business'; error: DomainError }
  /** No se resolvió ahora (sin señal, error transitorio, tiempo agotado): sigue
   * en la cola y se manda sola. */
  | { kind: 'queued' };

interface Waiter {
  resolve: (outcome: WriteOutcome) => void;
  timer: ReturnType<typeof setTimeout>;
}

const waiters = new Map<string, Waiter>();

/** Resuelve (y quita) a quien espera la operación `opId`, si hay alguien. Devuelve
 * `true` si había alguien en esta pestaña. */
function settleWaiter(opId: string, outcome: WriteOutcome): boolean {
  const waiter = waiters.get(opId);
  if (!waiter) return false;
  clearTimeout(waiter.timer);
  waiters.delete(opId);
  waiter.resolve(outcome);
  return true;
}

/** Cómo terminó una operación: lo resuelve a quien espera en esta pestaña y, si
 * nadie la espera acá, se lo cuenta a las otras (el formulario puede estar en
 * otra pestaña de la app). */
function reportOutcome(opId: string, outcome: Exclude<WriteOutcome, { kind: 'queued' }>): void {
  if (settleWaiter(opId, outcome)) return;
  const shared: SharedOutcome =
    outcome.kind === 'sent'
      ? { kind: 'sent', data: outcome.data }
      : {
          kind: 'business',
          message: outcome.error.message,
          ...(outcome.error.code ? { code: outcome.error.code } : {}),
          ...(outcome.error.status ? { status: outcome.error.status } : {}),
        };
  publishOutcome(opId, shared);
}

function outcomeFromShared(shared: SharedOutcome): WriteOutcome {
  if (shared.kind === 'sent') return shared;
  return { kind: 'business', error: new DomainError(shared.message, { code: shared.code, status: shared.status }) };
}

/** Deja como `queued` a quien espera una operación que SIGUE en la cola del
 * usuario: no se envió en este run (la retuvo un fallo transitorio, o no había
 * red) y esperar más solo dejaría un spinner. */
async function releaseWaitersOfQueuedOps(userId: string): Promise<void> {
  if (waiters.size === 0) return;
  const enCola = new Set(await db.outbox.where('userId').equals(userId).primaryKeys());
  for (const opId of [...waiters.keys()]) {
    if (enCola.has(opId)) settleWaiter(opId, { kind: 'queued' });
  }
}

/**
 * Registra a quien espera el resultado de la operación `opId` hasta `waitMs`.
 * Se registra ANTES de encolar: así el resultado no puede llegar antes que el
 * que lo espera. Al vencer el plazo (o al cancelar) resuelve `queued` — la
 * operación sigue en la cola, esperar solo era una cortesía para el que mira.
 */
export function waitForOutcome(
  opId: string,
  waitMs: number,
): { promise: Promise<WriteOutcome>; cancel: () => void } {
  ensureCrossTab();
  const promise = new Promise<WriteOutcome>((resolve) => {
    const timer = setTimeout(() => settleWaiter(opId, { kind: 'queued' }), waitMs);
    waiters.set(opId, { resolve, timer });
  });
  return { promise, cancel: () => settleWaiter(opId, { kind: 'queued' }) };
}

// --- Candado anti-concurrencia ----------------------------------------------

/** Respaldo cuando `navigator.locks` no existe (Safari viejo, o el entorno
 * de test) — un simple flag de módulo alcanza dentro de una pestaña. */
let fallbackLockHeld = false;

/** Esta pestaña está corriendo el replay ahora mismo. */
let holdingLock = false;

/**
 * Disparador perdido: con `ifAvailable: true`, un
 * `requestSync()` que llega mientras OTRO run ya tiene el candado se
 * descarta sin más — si eso pasa justo después del último `nextPendingOp`
 * del loop en curso (que ya devolvió `undefined`) pero ANTES de que el
 * candado se libere, la operación recién encolada queda esperando hasta el
 * próximo disparador (`online`, `visibilitychange`, o los 45 s del
 * intervalo) en vez de sincronizar apenas se guardó. Este flag lo recuerda:
 * se prende cuando un intento encuentra el candado ocupado, y se consume al
 * final del run QUE SÍ corrió, pidiendo un intento más — para entonces el
 * candado ya está libre (`maybeRerun` corre antes de soltar el candado, pero
 * `requestSync()` solo AGENDA un `setTimeout(0)`, que llega a ejecutarse
 * recién en el siguiente macrotask, después de que la promesa del candado
 * ya se resolvió). Si el candado lo tiene OTRA pestaña, se le avisa por el canal
 * entre pestañas para que ella lo consuma.
 */
let rerunRequested = false;

function maybeRerun(): void {
  if (!rerunRequested) return;
  rerunRequested = false;
  requestSync();
}

let crossTabListening = false;

function ensureCrossTab(): void {
  if (crossTabListening) return;
  crossTabListening = true;
  listenCrossTab({
    onOutcome: (opId, outcome) => {
      settleWaiter(opId, outcomeFromShared(outcome));
    },
    onSyncRequested: () => {
      if (holdingLock || fallbackLockHeld) rerunRequested = true;
    },
  });
}

async function withReplayLock(run: () => Promise<void>): Promise<void> {
  ensureCrossTab();
  const locks = typeof navigator !== 'undefined' ? navigator.locks : undefined;
  if (locks?.request) {
    await locks.request(REPLAY_LOCK_NAME, { ifAvailable: true }, async (lock) => {
      // `lock` es `null` cuando otra pestaña/instancia ya tiene el candado
      // (`ifAvailable: true`) — no se espera; se recuerda con
      // `rerunRequested` y se le avisa a la otra pestaña para que pida un run
      // más al terminar, en vez de esperar hasta el próximo disparador externo.
      if (!lock) {
        rerunRequested = true;
        requestRemoteSync();
        return;
      }
      holdingLock = true;
      try {
        await run();
      } finally {
        holdingLock = false;
        maybeRerun();
      }
    });
    return;
  }
  if (fallbackLockHeld) {
    rerunRequested = true;
    requestRemoteSync();
    return;
  }
  fallbackLockHeld = true;
  try {
    await run();
  } finally {
    fallbackLockHeld = false;
    maybeRerun();
  }
}

// --- Disparadores ------------------------------------------------------------

let currentUserId: string | null = null;
let syncScheduled = false;

/** Fija de qué usuario es la sesión activa — el replay SOLO procesa las
 * operaciones de este `userId` (ver `runReplay`). Cambiar de usuario (login
 * distinto) dispara un intento inmediato. */
export function setCurrentUser(userId: string | null): void {
  currentUserId = userId;
  if (userId) requestSync();
}

/** El usuario de la sesión activa para el motor — `submitWrite` encola a su nombre. */
export function getCurrentUserId(): string | null {
  return currentUserId;
}

/**
 * Pide un intento de replay. Coalesce ráfagas (varios `enqueue*` seguidos)
 * en un solo intento vía `setTimeout(0)` — no hace falta reaccionar a cada
 * `put` individual, alcanza con "pronto, una vez".
 */
export function requestSync(): void {
  if (syncScheduled) return;
  syncScheduled = true;
  setTimeout(() => {
    syncScheduled = false;
    void runReplayForCurrentUser();
  }, 0);
}

async function runReplayForCurrentUser(): Promise<void> {
  const userId = currentUserId;
  if (!userId) return;
  try {
    await withReplayLock(() => runReplay(userId));
  } catch (error) {
    // Un run que falla (la base local no abre, cuota) no debe dejar una promesa
    // sin atender: el próximo disparador lo vuelve a intentar.
    logger.error('La sincronización falló.', error);
  }
}

/**
 * Hook de arranque: engancha `setCurrentUser` al usuario de la sesión y los
 * disparadores de tiempo/conectividad (`online`, `visibilitychange` →
 * visible, cada 45 s). Se monta UNA vez, a nivel de SESIÓN
 * (`components/SyncEngineMount.tsx`, dentro del árbol autenticado de
 * `routes.tsx`) — no dentro de una pantalla en particular: si viviera solo
 * en `TerrenoLayout`, navegar a `/` desmontaría el motor y los disparadores se
 * cortarían hasta volver a Terreno.
 *
 * El intervalo de 45 s corre siempre mientras el componente está montado
 * (no solo "cuando hay pendientes"): `runReplay` ya sale rápido si no hay
 * nada que hacer (una consulta indexada que no encuentra nada), así que
 * prender/apagar el timer según el contador en vivo solo agregaría
 * complejidad sin un ahorro real.
 *
 * `userId` lo lee el LLAMADOR (`useCurrentUser()`) y lo pasa acá — mismo
 * motivo que en `useSyncState`, arriba.
 */
export function useSyncEngine(userId: string | null): void {
  useEffect(() => {
    setCurrentUser(userId);
  }, [userId]);

  useEffect(() => {
    const onOnline = () => requestSync();
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') requestSync();
    };
    window.addEventListener('online', onOnline);
    document.addEventListener('visibilitychange', onVisibilityChange);
    const intervalId = window.setInterval(() => requestSync(), SYNC_INTERVAL_MS);
    return () => {
      window.removeEventListener('online', onOnline);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.clearInterval(intervalId);
    };
  }, []);
}

// --- El motor propiamente dicho ---------------------------------------------

/**
 * Qué pasó con la operación que se acaba de procesar:
 * - `sent`: el servidor la aplicó y se borró de la cola.
 * - `rejected`: el servidor la rechazó por negocio; queda en `needs_attention` y el
 *   run sigue con las demás.
 * - `deferred`: falló por algo transitorio (timeout, 5xx, red con señal): se
 *   retiene ESA operación, su entidad y lo que dependa de ella por el resto del
 *   run, y se sigue con las independientes.
 * - `skipped`: ya no estaba disponible para tomarla (la editaron, descartaron o
 *   cambió de estado entre que se la eligió y que se la tomó).
 * - `stop`: no hay red en absoluto: seguir solo gastaría un intento por operación.
 * - `auth-required`: 401, la sesión venció; se corta hasta volver a iniciar sesión.
 */
type ProcessOutcome = 'sent' | 'rejected' | 'deferred' | 'skipped' | 'stop' | 'auth-required';

/** El 404 de estos dos endpoints no trae `code` propio (equipo u operador
 * que ya no existe en el catálogo) — se redacta por tipo de operación en vez
 * de mostrar el mensaje técnico del servidor. */
const NOT_FOUND_MESSAGES: Partial<Record<OutboxOp['type'], string>> = {
  createHallazgo: 'El equipo elegido ya no existe en el catálogo. Descartá este hallazgo y registralo de nuevo.',
  createTrabajoExtra:
    'El equipo o el operador elegido ya no existe en el catálogo. Descartá este trabajo y registralo de nuevo.',
};

function replayConfig(timeoutMs: number): AxiosRequestConfig {
  // `capturedAt`/`requestedAt` del PAYLOAD son la hora original del
  // dispositivo — este header es aparte, la hora del REINTENTO, para que el
  // backend pueda auditar cuánto tardó en llegar (`clientClockSkewMs`).
  return { timeout: timeoutMs, headers: { 'X-Client-Time': new Date().toISOString() } };
}

/** Corre un paso que ocurre DESPUÉS de que el servidor aplicó la operación (parsear
 * la respuesta, escribir el caché): si lanza, la operación ya está hecha, así que
 * un fallo acá se registra y no se trata como un error de envío (reenviarla una y
 * otra vez no arregla nada y traba la cola). */
function afterServerAccepted(what: string, step: () => void): void {
  try {
    step();
  } catch (error) {
    logger.error(`El servidor aplicó ${what}, pero no se pudo actualizar la pantalla.`, error);
  }
}

/** Upsert del reporte en `shift.exitReports` de cada tarjeta incluida —
 * evita esperar el próximo refetch para que "Reporte de salida" pase a
 * 'enviado' (mismo criterio de "nunca parpadea" que `applyCardToCache`). */
function applyReportToCache(cardIds: readonly string[], report: ShiftReportResponse): void {
  const idSet = new Set(cardIds);
  queryClient.setQueryData<ShiftCardResponse[]>(SHIFT_CARDS_MINE_KEY, (old) => {
    if (!old) return old;
    return old.map((card) => {
      if (!idSet.has(card.id) || !card.shift) return card;
      const yaEsta = card.shift.exitReports.some((r) => r.id === report.id);
      const exitReports = yaEsta
        ? card.shift.exitReports
        : [
            ...card.shift.exitReports,
            {
              id: report.id,
              requestedAt: report.requestedAt,
              cardCount: report.cardCount,
              emailStatus: report.emailStatus,
            },
          ];
      return { ...card, shift: { ...card.shift, exitReports } };
    });
  });

  if (report.missingCardIds.length > 0) {
    // No hay un lugar persistido natural para esto (la operación ya se
    // borró del outbox al llegar acá) — un aviso puntual en el estado del
    // motor es la forma más honesta de no ocultar que el PDF quedó
    // incompleto, sin que `offline/` dispare UI directo (`components/
    // SyncEngineMount.tsx` lo presenta y lo limpia, ver `EngineState.notice`).
    useEngineStore.setState({
      notice: `Reporte enviado con equipos faltantes: ${report.missingCardIds.length} equipo(s) no se encontraron en el servidor al generar el PDF.`,
    });
  }
}

/** Sin red en absoluto: el navegador sabe que no hay conexión y la request ni
 * llegó a salir. */
function hasNoNetwork(error: DomainError): boolean {
  return error.status == null && typeof navigator !== 'undefined' && navigator.onLine === false;
}

/**
 * `undefined` (sin `status` HTTP) normalmente significa error de red o
 * timeout — axios nunca llegó a recibir una respuesta. PERO unos códigos
 * PROPIOS del frontend (no vienen de axios) también llegan sin `status`:
 * `PHOTO_MISSING` (no hay nada que reintentar solo, falta la foto),
 * `FILE_TOO_LARGE`/`FILE_TYPE_NOT_ALLOWED` (el archivo guardado el servidor no lo
 * aceptará nunca) e `INVALID_RESPONSE` (`toDomainError`, `lib/api-error.ts`: el
 * servidor SÍ contestó — puede haber aplicado el cambio igual — pero el body no
 * calza con el contrato; reintentar a ciegas repetiría el mismo parseo roto para
 * siempre y trabaría la cola). Por eso se chequean ANTES que `status == null`.
 *
 * `429` con `code: 'REPORT_RATE_LIMITED'` (límite de reportes por turno,
 * `offline/outbox.ts#enqueueExitReport`/backend) tampoco es transitorio en
 * el sentido de "reintentar pronto arregla esto": reintentar automático
 * mientras el límite sigue vigente solo la deja rebotando — es un caso de
 * negocio, `needs_attention`. Un 429 SIN ese code (rate-limit genérico de
 * otro endpoint) sigue tratándose como transitorio.
 *
 * Los 5xx: solo 500 y 501 cuentan para el tope (`MAX_SERVER_ERROR_ATTEMPTS`) — la
 * operación misma rompe al servidor y reintentarla para siempre retendría todo lo
 * que depende de ella. 502/503/504 (y los 52x de un proxy) son infraestructura caída:
 * transitorios, sin tope. 408/425/429 son de la conexión, no del registro.
 */
function classify(error: DomainError, op: OutboxOp): 'auth' | 'business' | 'transient' {
  if (
    error.code === 'PHOTO_MISSING' ||
    error.code === 'INVALID_RESPONSE' ||
    error.code === 'ENDPOINT_NOT_QUEUEABLE' ||
    error.code === 'FILE_TOO_LARGE' ||
    error.code === 'FILE_TYPE_NOT_ALLOWED'
  ) {
    return 'business';
  }
  if (error.status === 401) return 'auth';
  if (error.status === 429 && error.code === 'REPORT_RATE_LIMITED') return 'business';
  if (error.status == null) return 'transient';
  if (error.status >= 500) {
    if (!COUNTED_SERVER_STATUSES.has(error.status)) return 'transient';
    return (op.serverErrors ?? 0) + 1 >= MAX_SERVER_ERROR_ATTEMPTS ? 'business' : 'transient';
  }
  if (RETRYABLE_CLIENT_STATUSES.has(error.status)) return 'transient';
  return 'business';
}

/** `toDomainError` redacta el error de red como fallo de un guardado de
 * oficina ("no se pudo guardar…"), que en el outbox es falso: el registro
 * SÍ está guardado y se reintenta solo. */
function transientMessage(error: DomainError): string {
  return error.status == null
    ? 'Sin señal: se reintentará automáticamente.'
    : 'El servidor no respondió bien: se reintentará automáticamente.';
}

/**
 * Clasifica el error de UNA operación y decide qué hacer con ella y con el run:
 * - `'auth'` (401): la operación vuelve a su estado pendiente (no es su
 *   culpa), se marca `authRequired` en el motor y se anota que la sesión terminó
 *   (para no servirle sus cachés a la próxima); el run entero se corta.
 * - `'business'` (4xx que no es 401/408/425/429 — incluye el caso `ID_CONFLICT` de un
 *   replay de `openCard`/`sendExitReport`: si esa fila fuera NUESTRA, el
 *   backend habría respondido 200, así que un 409 acá SIEMPRE es un
 *   conflicto real, nunca un falso positivo): `needs_attention`, y el run
 *   CONTINÚA con la siguiente operación.
 * - `'transient'` (red/timeout/5xx de infraestructura/408/429): vuelve a pendiente y
 *   suma un intento. Si no hay red en absoluto, el run se corta (`'stop'`); si no, se
 *   retiene ESA operación y lo que depende de ella (`'deferred'`) y el run sigue
 *   con el resto: una foto que no sube con poca señal no puede frenar un JSON de 1 KB
 *   de otro equipo. El orden que importa (abrir → cerrar → reporte) lo da `dependsOn`.
 */
async function handleOpError(op: OutboxOp, error: unknown): Promise<ProcessOutcome> {
  const domainError = error instanceof DomainError ? error : toDomainError(error, 'No se pudo sincronizar.');
  const kind = classify(domainError, op);
  const notFoundMessage = domainError.status === 404 && !domainError.code ? NOT_FOUND_MESSAGES[op.type] : undefined;
  const countedServerError = COUNTED_SERVER_STATUSES.has(domainError.status ?? 0);
  const message =
    notFoundMessage ??
    (kind === 'transient'
      ? transientMessage(domainError)
      : countedServerError
        ? 'El servidor falló varias veces seguidas con este registro. Reintentá más tarde o descartalo.'
        : mensajeErrorOperacion(domainError));
  const lastError: OutboxLastError = { code: domainError.code, status: domainError.status, message };

  // `put()` (reemplazo completo) en vez de `update()`: el `UpdateSpec` de
  // Dexie tipa por `keyof` de la UNIÓN `OutboxOp` — solo deja tocar las
  // claves comunes a todos los tipos de operación. Con `put({ ...op, ... })`
  // no hay esa limitación.
  if (kind === 'auth') {
    await db.outbox.put({ ...op, status: pendingStatusFor(op), updatedAt: Date.now() });
    markSessionEnded();
    useEngineStore.setState({ authRequired: true });
    settleWaiter(op.id, { kind: 'queued' });
    return 'auth-required';
  }

  if (kind === 'business') {
    await db.outbox.put({ ...op, status: 'needs_attention', lastError, updatedAt: Date.now() });
    reportOutcome(op.id, {
      kind: 'business',
      error: new DomainError(message, { code: domainError.code, status: domainError.status }),
    });
    return 'rejected';
  }

  await db.outbox.put({
    ...op,
    status: pendingStatusFor(op),
    attempts: op.attempts + 1,
    ...(countedServerError ? { serverErrors: (op.serverErrors ?? 0) + 1 } : {}),
    lastError,
    updatedAt: Date.now(),
  });
  useEngineStore.setState({ lastError });
  settleWaiter(op.id, { kind: 'queued' });
  return hasNoNetwork(domainError) ? 'stop' : 'deferred';
}

/**
 * Sube la foto guardada de una operación (cierre de tarjeta o hallazgo) y
 * deja la operación en `pending_claim` con la `tmpKey` resultante.
 */
async function uploadOpPhoto(op: PhotoOp, photoId: string, missingMessage: string): Promise<string> {
  const photoRow = await db.blobs.get(photoId);
  if (!photoRow) {
    // No debería pasar (se guardan en la misma transacción que la
    // operación, ver `offline/outbox.ts`) — si pasa, es un error de negocio:
    // no hay una foto que resubir, así que no tiene sentido reintentar solo.
    throw new DomainError(missingMessage, { code: 'PHOTO_MISSING' });
  }
  const file = new File([photoRow.data], photoRow.name, { type: photoRow.mime });
  const uploaded = await uploadFile(file, replayConfig(uploadTimeoutMs(photoRow.data.byteLength)));
  // Sin tocar `status`: sigue `syncing` mientras la request está en vuelo, así
  // una edición del payload (`offline/outbox.ts#patchOp`) sabe que no puede
  // cambiarla ahora. Si el POST falla, `handleOpError` la deja en
  // `pending_claim` porque ya hay `tmpKey`.
  await db.outbox.put({ ...op, tmpKey: uploaded.key, updatedAt: Date.now() });
  return uploaded.key;
}

/**
 * Pipeline común de las operaciones con foto: subir (si falta la `tmpKey`) →
 * mandar el POST con la key → borrar foto y operación. `send` hace el POST y
 * el upsert en caché; recibe la `tmpKey` (o `undefined` si la operación no
 * lleva foto, caso del hallazgo sin adjunto).
 */
async function processPhotoOp<T extends PhotoOp>(
  op: T,
  missingPhotoMessage: string,
  send: (op: T, tmpKey: string | undefined) => Promise<void>,
  allowExpiredRetry = true,
): Promise<ProcessOutcome> {
  // `currentOp` (no el `op` del parámetro) es lo que se manda a
  // `handleOpError`/se reintenta de acá en más: si la subida de la foto
  // tuvo éxito pero el POST que sigue falla, `handleOpError` guarda el objeto
  // que se le pasa con `put()` (reemplazo completo) — pasar el `op` VIEJO
  // (sin `tmpKey`) borraría la key recién subida, y el próximo intento la
  // resubiría de nuevo (un objeto `tmp/` huérfano cada vez).
  let currentOp = op;
  let tmpKey = currentOp.tmpKey;
  if (!tmpKey && currentOp.photoId) {
    try {
      tmpKey = await uploadOpPhoto(currentOp, currentOp.photoId, missingPhotoMessage);
      currentOp = { ...currentOp, tmpKey } as T;
    } catch (error) {
      return handleOpError(currentOp, error);
    }
  }

  try {
    await send(currentOp, tmpKey);
    if (currentOp.photoId) await db.blobs.delete(currentOp.photoId);
    await db.outbox.delete(currentOp.id);
    return 'sent';
  } catch (error) {
    if (allowExpiredRetry && error instanceof DomainError && error.code === 'TMP_KEY_EXPIRED') {
      // La key temporal expiró (objetos `tmp/` viven 1 día) entre que se
      // subió y que se pudo reclamar — se limpia y se resube UNA vez en el
      // mismo run, no en el próximo trigger (si volviera a expirar en el
      // segundo intento, algo más grave está pasando y se trata como
      // cualquier otro error de negocio).
      const cleared = { ...currentOp, tmpKey: undefined } as T;
      await db.outbox.put({ ...cleared, updatedAt: Date.now() });
      return processPhotoOp(cleared, missingPhotoMessage, send, false);
    }
    return handleOpError(currentOp, error);
  }
}

function processCloseCard(op: CloseCardOp): Promise<ProcessOutcome> {
  return processPhotoOp(
    op,
    'Falta la foto guardada para cerrar esta tarjeta — hay que volver a tomarla.',
    async (current, tmpKey) => {
      // Un cierre siempre lleva foto (`photoId` es obligatorio), así que el
      // pipeline ya subió la foto antes de llegar acá.
      if (!tmpKey) throw new DomainError('Falta la foto del cierre.', { code: 'PHOTO_MISSING' });
      const card = await ShiftCardAPI.closeCard(
        current.payload.cardId,
        { ...current.payload.input, tmpPhotoKey: tmpKey },
        replayConfig(JSON_TIMEOUT_MS),
      );
      afterServerAccepted('el cierre de la tarjeta', () => applyCardToCache(card));
    },
  );
}

function processCreateHallazgo(op: CreateHallazgoOp): Promise<ProcessOutcome> {
  return processPhotoOp(
    op,
    'Falta la foto guardada de este hallazgo — descartalo y volvé a registrarlo.',
    async (current, tmpKey) => {
      // `capturedAt` viaja dentro del payload: es la hora ORIGINAL del
      // dispositivo, nunca la del reintento.
      const hallazgo = await createHallazgo(
        { ...current.payload, ...(tmpKey ? { fotoKey: tmpKey } : {}) },
        replayConfig(JSON_TIMEOUT_MS),
      );
      afterServerAccepted('el hallazgo', () => applyHallazgoToCache(hallazgo));
    },
  );
}

/** Qué se debe refrescar al terminar el run: lo que cambió cada operación enviada. */
const pendingRefresh = new Set<QueryKeyName>();

/** Invalida las keys con nombre — una sola vez cada una. Por defecto solo las
 * queries en pantalla; `'all'` también las que no lo están, que si no quedan viejas
 * y no se vuelven a pedir (ni se actualiza lo que el Service Worker guardó). */
function invalidateNamed(names: Iterable<QueryKeyName>, refetchType: 'active' | 'all' = 'active'): void {
  for (const name of new Set(names)) void queryClient.invalidateQueries({ queryKey: QUERY_KEYS[name], refetchType });
}

/**
 * Procesador GENÉRICO de `httpWrite`: sube los archivos pendientes (guardando
 * cada `tmpKey` apenas existe, para no resubirlos si el POST falla), manda la
 * request que describe el REGISTRO con `X-Expected` + `X-Client-Time`, escribe
 * el resultado en el caché, invalida las keys con nombre y avisa a quien
 * espera. Un `TMP_KEY_EXPIRED` limpia las keys y resube UNA vez.
 */
async function processHttpWrite(op: HttpWriteOp, allowExpiredRetry = true): Promise<ProcessOutcome> {
  if (!isEndpointKey(op.endpoint)) {
    return handleOpError(
      op,
      new DomainError('Esta operación guardada no es compatible con esta versión de la app. Descartala.', {
        code: 'ENDPOINT_NOT_QUEUEABLE',
      }),
    );
  }
  const def = ENDPOINTS[op.endpoint];
  // `current` (no `op`) es lo que se pasa a `handleOpError`: ver el comentario
  // de `processPhotoOp` — pasar la operación vieja borraría las keys ya subidas.
  let current = op;

  try {
    for (const file of current.files ?? []) {
      if (file.tmpKey) continue;
      const row = await db.blobs.get(file.blobId);
      if (!row) {
        throw new DomainError('Falta un archivo guardado en el equipo — descartá este registro y volvé a cargarlo.', {
          code: 'PHOTO_MISSING',
        });
      }
      const uploaded = await uploadFile(
        new File([row.data], row.name, { type: row.mime }),
        replayConfig(uploadTimeoutMs(row.data.byteLength)),
      );
      current = {
        ...current,
        files: (current.files ?? []).map((f) => (f.blobId === file.blobId ? { ...f, tmpKey: uploaded.key } : f)),
        updatedAt: Date.now(),
      };
      await db.outbox.put(current);
    }

    const body = { ...current.body };
    for (const file of current.files ?? []) body[file.field] = file.tmpKey;
    const headers: Record<string, string> = { 'X-Client-Time': new Date().toISOString() };
    // Los valores base pueden traer texto libre (observaciones con "—", comillas
    // tipográficas, emojis) y un header HTTP solo admite Latin-1: el servidor lo
    // decodifica con `decodeURIComponent` + `JSON.parse`. Único lugar donde se
    // arma este header.
    if (current.expected) headers['X-Expected'] = encodeURIComponent(JSON.stringify(current.expected));

    const raw = await sendWrite({
      method: def.method,
      url: def.path(current.params),
      body,
      headers,
      timeout: JSON_TIMEOUT_MS,
      failMessage: def.failMessage,
    });
    afterServerAccepted(`la escritura ${op.endpoint}`, () => def.applyResponse(raw));
    return await finishHttpWrite(current, def.invalidate, raw);
  } catch (error) {
    if (error instanceof DomainError) {
      if (allowExpiredRetry && error.code === 'TMP_KEY_EXPIRED' && (current.files?.length ?? 0) > 0) {
        const cleared: HttpWriteOp = {
          ...current,
          files: (current.files ?? []).map((f) => ({ field: f.field, blobId: f.blobId })),
          updatedAt: Date.now(),
        };
        await db.outbox.put(cleared);
        return processHttpWrite(cleared, false);
      }
      // Un DELETE cuyo recurso ya no existe: eso era justo lo que se quería.
      if (error.status === 404 && def.notFoundIsDone) {
        return finishHttpWrite(current, def.invalidate, undefined);
      }
    }
    return handleOpError(current, error);
  }
}

/**
 * Las ediciones que quedaron detrás de `done` sobre la misma entidad se armaron
 * con una base que pudo no incluir su cambio (cuando `done` esperaba una acción
 * humana, la pantalla no lo contaba como "ya cambiado"). Ahora que se aplicó, el
 * servidor tiene su valor: esa es la base que su precondición debe esperar. Sin
 * esto, "Sobrescribir" la primera dejaba a la segunda chocando contra un cambio
 * del propio usuario (`STALE_UPDATE` falso).
 */
async function rebaseFollowingEdits(done: HttpWriteOp): Promise<void> {
  if (!done.entityKey) return;
  const campos = Object.entries(done.body).filter(([, valor]) => valor !== undefined);
  if (campos.length === 0) return;
  const mismaEntidad = await db.outbox.where('entityKey').equals(done.entityKey).toArray();
  const detras = mismaEntidad.filter(
    (o): o is HttpWriteOp => o.type === 'httpWrite' && o.userId === done.userId && o.seq > done.seq,
  );
  for (const op of detras) {
    const esperado = op.expected;
    if (!esperado) continue;
    const rebasado = { ...esperado };
    let cambio = false;
    for (const [campo, valor] of campos) {
      if (campo in rebasado) {
        rebasado[campo] = valor;
        cambio = true;
      }
    }
    if (cambio) await db.outbox.put({ ...op, expected: rebasado, updatedAt: Date.now() });
  }
}

async function finishHttpWrite(
  op: HttpWriteOp,
  invalidate: readonly QueryKeyName[],
  data: unknown,
): Promise<ProcessOutcome> {
  await db.transaction('rw', db.outbox, db.blobs, async () => {
    await db.blobs.bulkDelete((op.files ?? []).map((f) => f.blobId));
    await db.outbox.delete(op.id);
    await rebaseFollowingEdits(op);
  });
  const names = [...invalidate, ...(op.invalidate ?? [])];
  for (const name of names) pendingRefresh.add(name);
  invalidateNamed(names);
  reportOutcome(op.id, { kind: 'sent', data });
  return 'sent';
}

/**
 * Toma la operación para enviarla: la relee DENTRO de una transacción y marca
 * `syncing` sobre esa copia fresca. Elegir la operación y tomarla son dos pasos;
 * en el medio una edición del payload (`offline/outbox.ts#patchOp`) o un
 * descarte pueden haber ocurrido, y escribir la copia vieja los perdería (el
 * servidor recibiría el valor anterior, o una operación descartada reviviría).
 *
 * `dispatched` queda grabado desde acá: a partir de este punto la operación
 * puede haber llegado al servidor (timeout tras el commit, app matada a
 * mitad de la request), así que ya no se puede editar su payload en el lugar
 * (`patchOp`). Es ESTE objeto el que baja a todo lo que reescribe la
 * operación, para que la marca sobreviva a `handleOpError`.
 */
async function claimOp(id: string, userId: string): Promise<OutboxOp | undefined> {
  return db.transaction('rw', db.outbox, async () => {
    const fresh = await db.outbox.get(id);
    if (!fresh || fresh.userId !== userId || fresh.status === 'needs_attention' || fresh.status === 'syncing') {
      return undefined;
    }
    const claimed: OutboxOp = { ...fresh, status: 'syncing', dispatched: true, updatedAt: Date.now() };
    await db.outbox.put(claimed);
    return claimed;
  });
}

async function processOp(userId: string, candidate: OutboxOp): Promise<ProcessOutcome> {
  const op = await claimOp(candidate.id, userId);
  if (!op) return 'skipped';

  if (op.type === 'closeCard') return finishLegacy(await processCloseCard(op));
  if (op.type === 'createHallazgo') return finishLegacy(await processCreateHallazgo(op));
  if (op.type === 'httpWrite') return processHttpWrite(op);

  try {
    if (op.type === 'openCard') {
      const card = await ShiftCardAPI.openCard(op.payload, replayConfig(JSON_TIMEOUT_MS));
      afterServerAccepted('la apertura de la tarjeta', () => applyCardToCache(card));
    } else if (op.type === 'createTrabajoExtra') {
      const trabajo = await createTrabajoExtra(op.payload, replayConfig(JSON_TIMEOUT_MS));
      afterServerAccepted('el trabajo extra', () => applyTrabajoExtraToCache(trabajo));
    } else if (op.type === 'sendExitReport') {
      const report = await ShiftReportAPI.sendExitReport(op.payload, replayConfig(JSON_TIMEOUT_MS));
      afterServerAccepted('el reporte de salida', () => applyReportToCache(op.payload.cardIds, report));
    } else {
      // Una operación guardada por una versión futura (o dañada): no se sabe
      // enviarla y reintentar no lo arregla.
      return handleOpError(
        op,
        new DomainError('Esta operación guardada no es compatible con esta versión de la app. Descartala.', {
          code: 'ENDPOINT_NOT_QUEUEABLE',
        }),
      );
    }
    await db.outbox.delete(op.id);
    return finishLegacy('sent');
  } catch (error) {
    return handleOpError(op, error);
  }
}

/** Las operaciones que no pasan por el registro de endpoints refrescan siempre las
 * mismas listas al enviarse. */
function finishLegacy(outcome: ProcessOutcome): ProcessOutcome {
  if (outcome === 'sent') for (const name of LEGACY_REFRESH) pendingRefresh.add(name);
  return outcome;
}

/** La siguiente operación pendiente del usuario, FIFO por `seq` — excluye
 * `needs_attention` (espera una acción humana) y `syncing`, y retiene las que
 * dependen de una retenida (ver el recorrido abajo). `deferred` son las que ya
 * fallaron por algo transitorio en ESTE run. */
async function nextPendingOp(userId: string, deferred: ReadonlySet<string>): Promise<OutboxOp | undefined> {
  const ops = (
    await db.outbox.where('[userId+seq]').between([userId, -Infinity], [userId, Infinity]).toArray()
  ).sort(bySeq);
  // Recorrido FIFO con dos conjuntos de "retenidos": las operaciones que
  // esperan una acción humana (`needs_attention`), las que fallaron por algo
  // transitorio en este run (`deferred`) o que están bloqueadas por otra, y las
  // entidades que tocan. Una operación posterior se retiene si
  // `dependsOn` apunta a una retenida (transitivo, porque el recorrido sigue el
  // orden) o si actúa sobre una entidad con una operación anterior retenida:
  // mandarla igual aplicaría un cambio sobre algo que nunca llegó, o se
  // saltaría el orden entre dos ediciones del mismo dato. NO cambia su
  // `status` ni altera el orden del resto de la cola.
  const heldIds = new Set<string>();
  const heldKeys = new Set<string>();
  for (const op of ops) {
    const waitingForSomeone = op.status === 'needs_attention' || deferred.has(op.id);
    const blocked =
      !waitingForSomeone &&
      ((op.dependsOn ?? []).some((id) => heldIds.has(id)) || (op.entityKey != null && heldKeys.has(op.entityKey)));
    if (waitingForSomeone || blocked) {
      heldIds.add(op.id);
      if (op.entityKey) heldKeys.add(op.entityKey);
      continue;
    }
    // `syncing`: ya la está procesando ESTE mismo run (no debería verse porque
    // el run es secuencial, pero queda como guarda).
    if (op.status !== 'syncing') return op;
  }
  return undefined;
}

/**
 * `processOp` deja una operación en `'syncing'` mientras la request está en
 * vuelo, y `nextPendingOp` la excluye a propósito (para no procesarla dos
 * veces EN EL MISMO run). Pero
 * si la pestaña/PWA se mata a mitad de esa request — un iPad mata apps en
 * segundo plano todo el tiempo, o simplemente se recarga la página — esa
 * operación queda en `'syncing'` PARA SIEMPRE: ningún run futuro la vuelve a
 * tomar (`nextPendingOp` la sigue excluyendo) y su foto nunca se borra.
 *
 * El candado (`withReplayLock`) garantiza que acá adentro no hay OTRO run
 * de OTRA pestaña en vuelo — así que cualquier `'syncing'` que quede de este
 * usuario a esta altura es necesariamente basura de un run anterior que
 * nunca terminó, nunca la operación que este mismo run está procesando
 * ahora mismo (eso pasa después, adentro del loop). El servidor es
 * idempotente (`id`/`closeClientId`/`id` de reporte, ver `types/shift.ts`),
 * así que reenviarla es seguro.
 */
async function resetStuckSyncingOps(userId: string): Promise<void> {
  const stuck = await db.outbox
    .where('[userId+seq]')
    .between([userId, -Infinity], [userId, Infinity])
    .and((op) => op.status === 'syncing')
    .toArray();
  await Promise.all(
    stuck.map((op) => db.outbox.put({ ...op, status: pendingStatusFor(op), updatedAt: Date.now() })),
  );
}

/** Al terminar un run con conexión: las listas que cambiaron por lo enviado se
 * refrescan de verdad, también las que no están en pantalla, y antes se quita del
 * cache del Service Worker su copia vieja (ver `purgeApiCacheFor`). Así un arranque
 * sin señal posterior encuentra lo recién sincronizado. */
async function refreshAfterSync(): Promise<void> {
  const names = [...pendingRefresh];
  pendingRefresh.clear();
  if (names.length === 0) return;
  await purgeApiCacheFor(names);
  invalidateNamed(names, 'all');
}

async function runReplay(userId: string): Promise<void> {
  await resetStuckSyncingOps(userId);
  useEngineStore.setState({ syncing: true });
  let authRequired = false;
  let stopped = false;
  // Un fallo transitorio de este run deja `lastError`; si todo salió bien (o solo
  // quedaron `needs_attention`), cualquier error viejo ya es historia.
  let hadTransientFailure = false;
  const deferred = new Set<string>();

  try {
    for (;;) {
      // Otra pestaña pudo cambiar de usuario: no se manda lo de uno con la
      // cookie del otro.
      if (currentUserId !== userId) break;
      const op = await nextPendingOp(userId, deferred);
      if (!op) break;
      const outcome = await processOp(userId, op);
      if (outcome === 'skipped') deferred.add(op.id);
      else if (outcome === 'deferred') {
        deferred.add(op.id);
        hadTransientFailure = true;
      } else if (outcome === 'stop') {
        stopped = true;
        hadTransientFailure = true;
        break;
      } else if (outcome === 'auth-required') {
        authRequired = true;
        break;
      }
    }

    useEngineStore.setState((state) => ({
      authRequired,
      lastSyncAt: Date.now(),
      lastError: hadTransientFailure ? state.lastError : null,
    }));

    // Lo que quedó en la cola sin enviarse no se va a resolver mientras alguien
    // mira: que no esperen un spinner por algo que no va a pasar.
    if (hadTransientFailure || authRequired) await releaseWaitersOfQueuedOps(userId);
    // Sin red o con la sesión vencida el refetch no podría traer nada nuevo, y
    // quitar antes el cache del Service Worker solo dejaría sin lecturas: las
    // listas pendientes de refrescar esperan al próximo run con conexión.
    if (!stopped && !authRequired) await refreshAfterSync();
  } finally {
    useEngineStore.setState({ syncing: false });
  }
}

/**
 * Resetea TODO el estado de módulo del motor — exportado SOLO para los tests del
 * motor, que si no dejarían `syncScheduled`/`rerunRequested`/`fallbackLockHeld`
 * (variables de módulo, no del store) en un valor de un test anterior. Nunca se
 * llama desde código de producción.
 */
export function resetReplayEngineForTests(): void {
  currentUserId = null;
  syncScheduled = false;
  rerunRequested = false;
  fallbackLockHeld = false;
  holdingLock = false;
  crossTabListening = false;
  closeCrossTab();
  pendingRefresh.clear();
  for (const opId of [...waiters.keys()]) settleWaiter(opId, { kind: 'queued' });
  useEngineStore.setState({ syncing: false, authRequired: false, lastSyncAt: null, lastError: null, notice: null });
}
