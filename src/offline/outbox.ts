import {
  bySeq,
  db,
  dependientesDe,
  hallazgoEntity,
  pendingStatusFor,
  shiftCardEntity,
  trabajoExtraEntity,
  type CloseCardOp,
  type CreateHallazgoOp,
  type CreateTrabajoExtraOp,
  type HttpWriteFile,
  type HttpWriteOp,
  type OpenCardOp,
  opsDeCreacion,
  type OutboxOp,
  type SendExitReportOp,
} from './db';
import { ENDPOINTS, type EndpointKey, type HttpParams } from './endpoints';
import { compressPhoto } from './photo';
import { getCurrentUserId, requestSync } from './replay';
import { DomainError } from '../lib/api-error';
import type { QueryKeyName } from '../lib/query-keys';
import {
  isAcceptedUploadType,
  MAX_UPLOAD_BYTES,
  UPLOAD_SIZE_ERROR_MESSAGE,
  UPLOAD_TYPE_ERROR_MESSAGE,
} from '../lib/upload-limits';
import { generateUuid } from '../lib/uuid';
import type { CreateHallazgoInput } from '../types/hallazgos';
import type { JsonObject } from '../types/json';
import type { CloseShiftCardInput, OpenShiftCardInput, SendExitReportInput } from '../types/shift';
import type { CreateTrabajoExtraInput } from '../types/trabajosExtra';

function now(): number {
  return Date.now();
}

// --- Encolado -----------------------------------------------------------------

/** `true` si Dexie/IndexedDB falló por falta de espacio — el error puede venir
 * envuelto (`inner`), según el navegador. */
function esErrorDeCuota(error: unknown): boolean {
  let actual: unknown = error;
  for (let nivel = 0; nivel < 4 && actual != null; nivel += 1) {
    if (typeof actual === 'object' && 'name' in actual && actual.name === 'QuotaExceededError') return true;
    actual = typeof actual === 'object' && 'inner' in actual ? actual.inner : null;
  }
  return false;
}

/**
 * Corre una escritura del outbox y traduce "no queda espacio en el equipo" a un
 * error de dominio con mensaje claro: sin esto el supervisor vería un error
 * técnico de IndexedDB y no sabría que lo que acaba de registrar NO se guardó.
 */
async function conCuota<T>(escritura: () => Promise<T>): Promise<T> {
  try {
    return await escritura();
  } catch (error: unknown) {
    if (esErrorDeCuota(error)) {
      throw new DomainError('No hay espacio en el equipo para guardar esto.', { code: 'STORAGE_FULL' });
    }
    throw error;
  }
}

/**
 * Siguiente `seq` del outbox: `max(ahora, última + 1)`. SOLO válida dentro de
 * una transacción `rw` que incluya `outbox` — leer la última y escribir la
 * nueva tienen que ser atómicas, o dos encolados concurrentes tomarían el mismo
 * número.
 */
async function nextSeq(): Promise<number> {
  const last = await db.outbox.orderBy('seq').last();
  return Math.max(now(), (last?.seq ?? 0) + 1);
}

/** Encola una operación SIN archivos: lee `seq` y escribe en una transacción. */
async function putOp(build: (seq: number, timestamp: number) => OutboxOp): Promise<void> {
  await conCuota(() =>
    db.transaction('rw', db.outbox, async () => {
      await db.outbox.put(build(await nextSeq(), now()));
    }),
  );
}

/**
 * Encola la apertura de una tarjeta. `input.id` (uuid del cliente) ES el id
 * de la operación — el mismo valor que ve el backend, sin mapeo (ver
 * `types/shift.ts#OpenShiftCardInput`). Llamado SIEMPRE desde
 * `hooks/useShiftRegister.ts#abrir`, con o sin señal — un único camino.
 */
export async function enqueueOpenCard(userId: string, input: OpenShiftCardInput): Promise<void> {
  await putOp(
    (seq, timestamp): OpenCardOp => ({
      id: input.id,
      type: 'openCard',
      v: 1,
      userId,
      payload: input,
      status: 'pending',
      attempts: 0,
      seq,
      entityKey: shiftCardEntity(input.id),
      createdAt: timestamp,
      updatedAt: timestamp,
    }),
  );
  requestSync();
}

/**
 * Encola el cierre de una tarjeta. Comprime la foto (`offline/photo.ts`)
 * ANTES de abrir la transacción —la compresión no necesita ser atómica con
 * nada—, y guarda la fila de `blobs` + la operación en el outbox EN UNA
 * SOLA transacción Dexie: si el navegador se cierra a mitad de camino, o
 * existe la foto guardada Y su operación, o no existe ninguna de las dos —
 * nunca una foto huérfana sin operación que la reclame, ni una operación
 * `pending_upload` sin foto que subir.
 *
 * `input` es el body de cierre SIN `tmpPhotoKey` (todavía no existe — se
 * arma recién al subir la foto durante el replay). El id de la operación
 * es `input.closeClientId` — mismo criterio que `enqueueOpenCard`. El id de
 * la foto reutiliza el mismo `closeClientId`: es una relación 1:1 (una
 * tarjeta se cierra con exactamente una foto), así que no hace falta un
 * segundo uuid.
 *
 * El cierre `dependsOn` la apertura (mismo id que la tarjeta): si esa apertura
 * queda esperando una acción humana, el cierre no se manda; si se descarta,
 * se descarta con ella.
 */
export async function enqueueCloseCard(
  userId: string,
  cardId: string,
  input: Omit<CloseShiftCardInput, 'tmpPhotoKey'>,
  photo: File,
): Promise<void> {
  const compressed = await compressPhoto(photo);
  const photoId = input.closeClientId;

  await conCuota(() =>
    db.transaction('rw', db.outbox, db.blobs, async () => {
      const timestamp = now();
      await db.blobs.put({
        id: photoId,
        data: compressed.data,
        mime: compressed.mime,
        name: compressed.name,
        createdAt: timestamp,
      });
      const op: CloseCardOp = {
        id: input.closeClientId,
        type: 'closeCard',
        v: 1,
        userId,
        payload: { cardId, input },
        status: 'pending_upload',
        attempts: 0,
        photoId,
        seq: await nextSeq(),
        entityKey: shiftCardEntity(cardId),
        dependsOn: [cardId],
        createdAt: timestamp,
        updatedAt: timestamp,
      };
      await db.outbox.put(op);
    }),
  );
  requestSync();
}

/**
 * Encola el reporte de salida de turno. `input.id` (uuid del cliente) es el
 * id de la operación — mismo criterio que las otras dos.
 */
export async function enqueueExitReport(userId: string, input: SendExitReportInput): Promise<void> {
  await putOp(
    (seq, timestamp): SendExitReportOp => ({
      id: input.id,
      type: 'sendExitReport',
      v: 1,
      userId,
      payload: input,
      status: 'pending',
      attempts: 0,
      seq,
      createdAt: timestamp,
      updatedAt: timestamp,
    }),
  );
  requestSync();
}

/**
 * Encola un hallazgo, con foto opcional. Mismo criterio que
 * `enqueueCloseCard`: la foto se comprime ANTES de la transacción y la fila
 * de `blobs` + la operación se escriben juntas, así nunca queda una foto
 * sin operación ni una operación `pending_upload` sin foto. El id de la foto
 * es el del hallazgo (relación 1:1). Sin foto, la operación nace `pending`.
 */
export async function enqueueCreateHallazgo(
  userId: string,
  input: CreateHallazgoInput,
  photo?: File,
): Promise<void> {
  const compressed = photo ? await compressPhoto(photo) : undefined;

  await conCuota(() =>
    db.transaction('rw', db.outbox, db.blobs, async () => {
      const timestamp = now();
      const base = {
        id: input.id,
        type: 'createHallazgo' as const,
        v: 1 as const,
        userId,
        payload: input,
        attempts: 0,
        seq: await nextSeq(),
        entityKey: hallazgoEntity(input.id),
        createdAt: timestamp,
        updatedAt: timestamp,
      };
      if (!compressed) {
        const op: CreateHallazgoOp = { ...base, status: 'pending' };
        await db.outbox.put(op);
        return;
      }
      await db.blobs.put({
        id: input.id,
        data: compressed.data,
        mime: compressed.mime,
        name: compressed.name,
        createdAt: timestamp,
      });
      const op: CreateHallazgoOp = { ...base, status: 'pending_upload', photoId: input.id };
      await db.outbox.put(op);
    }),
  );
  requestSync();
}

/** Encola un trabajo extraordinario (sin foto). `input.id` es el id de la
 * operación — mismo criterio que las demás. */
export async function enqueueCreateTrabajoExtra(userId: string, input: CreateTrabajoExtraInput): Promise<void> {
  await putOp(
    (seq, timestamp): CreateTrabajoExtraOp => ({
      id: input.id,
      type: 'createTrabajoExtra',
      v: 1,
      userId,
      payload: input,
      status: 'pending',
      attempts: 0,
      seq,
      entityKey: trabajoExtraEntity(input.id),
      createdAt: timestamp,
      updatedAt: timestamp,
    }),
  );
  requestSync();
}

export interface HttpWriteSpec {
  /** Clave de idempotencia de la operación (uuid del cliente). */
  id: string;
  endpoint: EndpointKey;
  params: HttpParams;
  /** Solo lo que cambió, en un PATCH. */
  body: JsonObject;
  /** Valor base de cada campo tocado → header `X-Expected`. */
  expected?: JsonObject;
  /** Archivos por subir; el campo recibe la key al mandar la request. */
  files?: { field: string; file: File }[];
  entityKey?: string;
  dependsOn?: string[];
  label: string;
  invalidate?: QueryKeyName[];
}

/**
 * Encola una escritura genérica contra el REGISTRO de endpoints. Los archivos
 * (≤ 8 MB) se guardan en `blobs` en la MISMA transacción que la operación.
 * NO pide la sincronización: `submitWrite` registra primero a quien espera el
 * resultado y recién después la dispara.
 */
export async function enqueueHttpWrite(userId: string, spec: HttpWriteSpec): Promise<HttpWriteOp> {
  const def = ENDPOINTS[spec.endpoint];
  const archivos = spec.files ?? [];
  if (archivos.length > 0 && !def.carriesFiles) {
    throw new DomainError('Este endpoint no admite archivos.', { code: 'ENDPOINT_NOT_QUEUEABLE' });
  }
  const guardables = await Promise.all(archivos.map(async ({ field, file }) => ({ field, ...(await prepararArchivo(file)) })));

  const entityKey = spec.entityKey ?? def.entity?.(spec.params, spec.body);
  const claves = [...(entityKey ? [entityKey] : []), ...(def.parents?.(spec.params, spec.body) ?? [])];

  return conCuota(() =>
    db.transaction('rw', db.outbox, db.blobs, async () => {
      const timestamp = now();
      const files: HttpWriteFile[] = [];
      for (const { field, data, mime, name } of guardables) {
        const blobId = generateUuid();
        await db.blobs.put({ id: blobId, data, mime, name, createdAt: timestamp });
        files.push({ field, blobId });
      }
      const dependsOn = await dependenciasDeCreacion(userId, spec.id, claves, spec.dependsOn);
      const op: HttpWriteOp = {
        id: spec.id,
        type: 'httpWrite',
        v: 1,
        userId,
        endpoint: spec.endpoint,
        params: spec.params,
        body: spec.body,
        ...(spec.expected ? { expected: spec.expected } : {}),
        ...(files.length > 0 ? { files } : {}),
        label: spec.label,
        ...(spec.invalidate ? { invalidate: spec.invalidate } : {}),
        ...(def.creates ? { creates: true as const } : {}),
        status: files.length > 0 ? 'pending_upload' : 'pending',
        attempts: 0,
        seq: await nextSeq(),
        ...(entityKey ? { entityKey } : {}),
        ...(dependsOn.length > 0 ? { dependsOn } : {}),
        createdAt: timestamp,
        updatedAt: timestamp,
      };
      await db.outbox.put(op);
      return op;
    }),
  );
}

interface ArchivoGuardable {
  data: ArrayBuffer;
  mime: string;
  name: string;
}

/**
 * Deja el archivo listo para guardarlo en el equipo: una foto se comprime (una
 * tablet sin señal acumula varias) y todo se valida contra lo que el servidor va
 * a aceptar — un archivo que se rechazaría al sincronizar queda trabado en la
 * cola, así que se rechaza acá, mientras la persona todavía puede elegir otro.
 */
async function prepararArchivo(file: File): Promise<ArchivoGuardable> {
  const guardable: ArchivoGuardable = file.type.startsWith('image/')
    ? await compressPhoto(file)
    : { data: await file.arrayBuffer(), mime: file.type || 'application/octet-stream', name: file.name };
  if (!isAcceptedUploadType(guardable.mime)) {
    throw new DomainError(UPLOAD_TYPE_ERROR_MESSAGE, { code: 'FILE_TYPE_NOT_ALLOWED' });
  }
  if (guardable.data.byteLength > MAX_UPLOAD_BYTES) {
    throw new DomainError(UPLOAD_SIZE_ERROR_MESSAGE, { code: 'FILE_TOO_LARGE' });
  }
  return guardable;
}

/**
 * Ids de las operaciones del usuario que CREAN alguna de las entidades `claves`
 * y todavía no terminaron, más las `explicitas`: lo que se encola sobre una
 * entidad cuya creación sigue esperando va detrás de ella (y se descarta con
 * ella). Se lee dentro de la transacción de encolado: así una creación que
 * termina justo ahora no deja una dependencia colgando.
 */
async function dependenciasDeCreacion(
  userId: string,
  propia: string,
  claves: readonly string[],
  explicitas: readonly string[] = [],
): Promise<string[]> {
  if (claves.length === 0) return [...new Set(explicitas)];
  const ops = await db.outbox
    .where('entityKey')
    .anyOf([...claves])
    .filter((op) => op.userId === userId && op.id !== propia)
    .toArray();
  const ids = claves.flatMap((clave) => opsDeCreacion(clave, ops));
  return [...new Set([...explicitas, ...ids])];
}

/**
 * Escrituras genéricas que la entidad `entityKey` tiene guardadas en el equipo
 * y que el servidor todavía no vio, en el orden en que se mandarán. Excluye las
 * que esperan una acción humana (`needs_attention`): esas no se aplicarán por sí
 * solas, así que no se cuentan como "ya cambiado". Sin `userId` usa el de la
 * sesión del motor, igual que `submitWrite`.
 */
export async function escriturasPendientes(
  entityKey: string,
  endpoints?: readonly EndpointKey[],
  userId: string | null = getCurrentUserId(),
): Promise<HttpWriteOp[]> {
  if (!userId) return [];
  const ops = await db.outbox.where('entityKey').equals(entityKey).toArray();
  return ops
    .filter(
      (op): op is HttpWriteOp =>
        op.type === 'httpWrite' &&
        op.userId === userId &&
        op.status !== 'needs_attention' &&
        (!endpoints || endpoints.includes(op.endpoint)),
    )
    .sort(bySeq);
}

/**
 * Los campos que ya están guardados en el equipo para la entidad y que la
 * pantalla todavía no muestra (el servidor no los recibió), fusionados en orden.
 * La base de una edición nueva es lo que se ve MÁS esto: así su precondición
 * apunta al valor que el servidor tendrá cuando la edición anterior llegue, no
 * al que tiene hoy, y no choca con el cambio propio que va delante.
 */
export async function cambiosPendientes(
  entityKey: string,
  endpoints: readonly EndpointKey[],
  userId: string | null = getCurrentUserId(),
): Promise<JsonObject> {
  const resultado: JsonObject = {};
  for (const op of await escriturasPendientes(entityKey, endpoints, userId)) Object.assign(resultado, op.body);
  return resultado;
}

// --- Editar una operación ya encolada -----------------------------------------

export type PatchOutcome = 'updated' | 'missing' | 'maybe-sent';

/**
 * `true` si el servidor rechazó la operación de forma DEFINITIVA: un 4xx que no
 * sea 401/408/429. Solo entonces sabemos que no la aplicó. Un 5xx (incluido el
 * tope de reintentos) o una respuesta inválida pueden venir de una escritura que
 * sí se aplicó.
 */
function fueRechazadaSinAplicar(op: OutboxOp): boolean {
  const status = op.lastError?.status;
  return op.status === 'needs_attention' && status != null && status >= 400 && status < 500 && ![401, 408, 429].includes(status);
}

/**
 * Cambia el payload de una operación que todavía está en el equipo. Re-lee la
 * operación DENTRO de la transacción: el replay puede haberla terminado (o
 * tomado) desde que la pantalla la vio.
 * - `'maybe-sent'`: puede haber llegado al servidor (`dispatched`: en vuelo,
 *   con un error transitorio tras el envío, o interrumpida con la app cerrada).
 *   Cambiarla en el lugar se perdería en silencio: el servidor responde el
 *   reenvío del MISMO id con la fila que ya tiene e ignora el payload nuevo. El
 *   llamador encola una edición aparte.
 * - `'missing'`: ya se sincronizó (o se descartó): ídem.
 * Una operación rechazada de forma definitiva (`needs_attention` por un 4xx)
 * vuelve a quedar pendiente: editar es justamente la forma de arreglar lo que
 * el servidor rechazó.
 */
async function patchOp<T extends OutboxOp>(
  id: string,
  userId: string,
  type: T['type'],
  patch: (op: T) => T,
): Promise<PatchOutcome> {
  return conCuota(() =>
    db.transaction('rw', db.outbox, async () => {
      const op = await db.outbox.get(id);
      if (!op || op.userId !== userId || op.type !== type) return 'missing';
      if (op.dispatched && !fueRechazadaSinAplicar(op)) return 'maybe-sent';
      if (op.status === 'syncing') return 'maybe-sent';
      // `op.type === type` ya se verificó arriba; TS no estrecha una unión por
      // un parámetro genérico, de ahí el cast.
      const patched = patch(op as T);
      const status = op.status === 'needs_attention' ? pendingStatusFor(patched) : patched.status;
      await db.outbox.put({
        ...patched,
        status,
        ...(op.status === 'needs_attention' ? { lastError: undefined, serverErrors: 0 } : {}),
        updatedAt: now(),
      });
      return 'updated';
    }),
  ).then((outcome) => {
    if (outcome === 'updated') requestSync();
    return outcome;
  });
}

/** Cambia el operador / horómetro inicial de una apertura todavía pendiente. */
export function patchOpenCardOp(
  id: string,
  userId: string,
  patch: Partial<Pick<OpenShiftCardInput, 'operatorId' | 'valorInicial'>>,
): Promise<PatchOutcome> {
  return patchOp<OpenCardOp>(id, userId, 'openCard', (op) => ({ ...op, payload: { ...op.payload, ...patch } }));
}

/** Cambia horómetro final / litros / AdBlue / observaciones de un cierre todavía pendiente. */
export function patchCloseCardOp(
  id: string,
  userId: string,
  patch: Partial<
    Pick<CloseShiftCardInput, 'valorFinal' | 'fuelLiters' | 'adBlue' | 'adBlueLiters' | 'observaciones'>
  >,
): Promise<PatchOutcome> {
  return patchOp<CloseCardOp>(id, userId, 'closeCard', (op) => ({
    ...op,
    payload: { ...op.payload, input: { ...op.payload.input, ...patch } },
  }));
}

// --- Acciones de la hoja de sincronización -------------------------------------

/**
 * Reintenta una operación en `needs_attention` (acción "Reintentar" de
 * `SyncStatus`) — vuelve al estado pendiente que le corresponde y limpia el
 * último error, así no queda un mensaje viejo mientras el nuevo intento
 * está en vuelo.
 *
 * `userId` (defensa en profundidad): `SyncStatus` solo lista
 * las operaciones del usuario de la sesión (`useOutboxOps`), así que en la
 * UI normal `id` siempre es de ESE usuario — esto es una segunda barrera
 * por si algún día un `id` de otro usuario llega hasta acá (bug de UI, id
 * copiado a mano en devtools). Un `userId` que no calza no hace nada, en
 * vez de reintentar/descartar una operación ajena.
 */
export async function retryOp(id: string, userId: string): Promise<void> {
  const op = await db.outbox.get(id);
  if (!op || op.userId !== userId) return;
  // `put()` (reemplazo completo) en vez de `update()` (parche parcial): el
  // `UpdateSpec` de Dexie tipa por `keyof` de la UNIÓN `OutboxOp` — solo
  // acepta las claves comunes a todos los tipos de operación, y acá hace
  // falta tocar `lastError`, que si vive en un miembro le sobra a los otros.
  // Con `put()` y el objeto completo (`...op`) no hay ese problema.
  await db.outbox.put({
    ...op,
    status: pendingStatusFor(op),
    lastError: undefined,
    serverErrors: 0,
    updatedAt: now(),
  });
  requestSync();
}

/**
 * "Sobrescribir" (acción de `SyncStatus` para un `STALE_UPDATE`): otra persona
 * cambió el mismo dato entre que se guardó la edición y que llegó al servidor.
 * Se reenvía la MISMA operación sin la precondición (`expected`), así que gana
 * lo que escribió acá. Solo aplica a una escritura genérica.
 */
export async function overwriteOp(id: string, userId: string): Promise<void> {
  const op = await db.outbox.get(id);
  if (!op || op.userId !== userId || op.type !== 'httpWrite') return;
  const sinPrecondicion: HttpWriteOp = { ...op, expected: undefined };
  await db.outbox.put({
    ...sinPrecondicion,
    status: pendingStatusFor(sinPrecondicion),
    lastError: undefined,
    serverErrors: 0,
    updatedAt: now(),
  });
  requestSync();
}

/** Ids de blobs que una operación guardó. */
function blobIdsOf(op: OutboxOp): string[] {
  if ((op.type === 'closeCard' || op.type === 'createHallazgo') && op.photoId) return [op.photoId];
  if (op.type === 'httpWrite') return (op.files ?? []).map((f) => f.blobId);
  return [];
}

/**
 * Descarta una operación (acción "Descartar" de `SyncStatus`, con
 * confirmación en la UI) — borra también sus archivos guardados, para no
 * dejar una fila huérfana en `blobs`.
 *
 * Descartar arrastra con ella a todo lo que dependa de esa operación
 * (`dependsOn`, transitivo): un cierre cuya apertura falló NUNCA va a tener
 * una tarjeta que cerrar, y una edición de algo que no se creó tampoco. Se
 * borra todo (operaciones + archivos) en UNA transacción — la confirmación en
 * `SyncStatus` avisa esto explícito antes de llamar acá.
 *
 * `userId`: ver el comentario de `retryOp`.
 */
export async function discardOp(id: string, userId: string): Promise<void> {
  await db.transaction('rw', db.outbox, db.blobs, async () => {
    const op = await db.outbox.get(id);
    if (!op || op.userId !== userId) return;
    const propias = await db.outbox.where('userId').equals(userId).toArray();
    const borrar = [op, ...dependientesDe(id, propias)];
    await db.blobs.bulkDelete(borrar.flatMap(blobIdsOf));
    await db.outbox.bulkDelete(borrar.map((o) => o.id));
  });
}

/** Cuántas operaciones (en cualquier estado) tiene pendientes el usuario —
 * usado por el candado de `lib/logout.ts`: un logout con `count > 0` se
 * bloquea. */
export async function countPending(userId: string): Promise<number> {
  return db.outbox.where('userId').equals(userId).count();
}
