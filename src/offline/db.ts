import Dexie, { type Table } from 'dexie';

import type { EndpointKey } from './endpoints';
import type { QueryKeyName } from '../lib/query-keys';
import type { CreateHallazgoInput } from '../types/hallazgos';
import type { JsonObject } from '../types/json';
import type { CloseShiftCardInput, OpenShiftCardInput, SendExitReportInput } from '../types/shift';
import type { CreateTrabajoExtraInput } from '../types/trabajosExtra';

/**
 * Base de datos offline. Dos tablas:
 * - `outbox`: cola de operaciones pendientes de sincronizar (abrir/cerrar
 *   tarjeta, mandar reporte de salida, crear hallazgo / trabajo extra y las
 *   escrituras genéricas `httpWrite`). Una operación TERMINADA se BORRA — no
 *   existe un estado `'done'`, ver `offline/replay.ts`.
 * - `blobs`: los archivos pendientes de subir (foto de cierre, foto del
 *   hallazgo, PDF de un documento), guardados como `ArrayBuffer` (no
 *   `Blob`): el soporte de Blob en IndexedDB de Safari/iOS ha sido
 *   históricamente poco confiable, así que se evita del todo.
 *
 * `db.ts` solo declara el schema y los tipos — nunca escribe ni lee acá
 * (eso vive en `offline/outbox.ts` y `offline/replay.ts`) para que este
 * archivo se pueda importar desde cualquier lado sin arrastrar lógica.
 */

export type OutboxOpType =
  | 'openCard'
  | 'closeCard'
  | 'sendExitReport'
  | 'createHallazgo'
  | 'createTrabajoExtra'
  | 'httpWrite';

/** Identidad de la entidad sobre la que actúa una operación. Dos operaciones
 * con la misma clave se serializan: si una espera una acción humana, las
 * posteriores no se mandan (ver `offline/replay.ts#nextPendingOp`). */
export const shiftCardEntity = (cardId: string) => `shift-card:${cardId}`;
export const hallazgoEntity = (id: string) => `hallazgo:${id}`;
export const trabajoExtraEntity = (id: string) => `trabajo-extra:${id}`;
export const equipmentEntity = (id: string) => `equipment:${id}`;
export const equipmentDocumentEntity = (id: string) => `equipment-document:${id}`;
export const horometroEntity = (id: string) => `horometro:${id}`;
export const combustibleEntity = (id: string) => `combustible:${id}`;
/** Un ítem agrupa también sus movimientos, traspasos, ajustes y mínimos: todo lo
 * que toca su existencia se serializa detrás de lo que esté retenido del ítem. */
export const itemEntity = (id: string) => `item:${id}`;
export const categoryEntity = (id: string) => `category:${id}`;
export const branchEntity = (id: string) => `branch:${id}`;
export const operatorEntity = (id: string) => `operator:${id}`;
export const ordenEntity = (id: string) => `orden:${id}`;
export const intervencionEntity = (id: string) => `intervencion:${id}`;
export const actividadEntity = (id: string) => `actividad:${id}`;
export const umbralEntity = (id: string) => `umbral:${id}`;

/**
 * `'pending'`/`'pending_upload'`/`'pending_claim'`: esperando su turno en el
 * outbox (ver el detalle por tipo abajo). `'syncing'`: el replay la tiene en
 * vuelo AHORA MISMO — evita que un segundo trigger la vuelva a tomar si el
 * primero todavía no terminó de escribir el resultado. `'needs_attention'`:
 * el servidor la rechazó por una razón de NEGOCIO (no de red) — queda
 * visible en la hoja de sincronización con Reintentar/Descartar (o
 * Sobrescribir/Descartar si otra persona cambió el mismo dato).
 */
export type OutboxStatus = 'pending' | 'pending_upload' | 'pending_claim' | 'syncing' | 'needs_attention';

/** Mismo shape que arma `mensajeErrorTarjeta` a partir de un `DomainError`
 * (`hooks/useShiftCards.ts`) — se persiste para poder mostrarlo de nuevo
 * después de recargar la página sin tener que reintentar primero. */
export interface OutboxLastError {
  code?: string;
  status?: number;
  message: string;
}

interface OutboxBase {
  /** = la clave de idempotencia de la operación (`OpenShiftCardInput#id`,
   * `CloseShiftCardInput#closeClientId`, `SendExitReportInput#id`) — así el
   * id del outbox y el id que ve el backend son el MISMO valor, sin mapeo. */
  id: string;
  v: 1;
  userId: string;
  status: OutboxStatus;
  /** Reintentos por error transitorio (red/5xx/429) — ver
   * `offline/replay.ts#handleOpError`. No cuenta errores de negocio
   * (`needs_attention`) ni la pausa por 401. */
  attempts: number;
  /** Reintentos por 5xx — aparte de `attempts` porque tienen tope (ver
   * `offline/replay.ts#MAX_SERVER_ERROR_ATTEMPTS`) y los de red no. */
  serverErrors?: number;
  lastError?: OutboxLastError;
  /** El replay ya la tomó al menos una vez: puede haber llegado al servidor
   * aunque hoy figure `pending`. Una operación vieja sin la marca cuenta como
   * no enviada. */
  dispatched?: true;
  /** Orden FIFO ESTRICTO del replay: `max(Date.now(), última + 1)` calculado
   * dentro de la transacción de encolado (`offline/outbox.ts`). `createdAt`
   * no alcanza: dos operaciones del mismo milisegundo, o un reloj que
   * retrocede, las reordenarían. */
  seq: number;
  /** Ids de operaciones que deben terminar antes (típicamente la que crea la
   * entidad). Si una está en `needs_attention` esta no se manda, y si se
   * descarta esta se descarta con ella. */
  dependsOn?: string[];
  entityKey?: string;
  /** `Date.now()` — la hora en que se guardó; el orden lo da `seq`. */
  createdAt: number;
  updatedAt: number;
}

export interface OpenCardOp extends OutboxBase {
  type: 'openCard';
  payload: OpenShiftCardInput;
}

export interface CloseCardOp extends OutboxBase {
  type: 'closeCard';
  /** `cardId` es el id de la tarjeta a cerrar — el mismo id con el que se
   * abrió (real del servidor, o el uuid del cliente si esa apertura todavía
   * está pendiente en el outbox: el orden FIFO garantiza que ya viajó). El
   * body de cierre real (`CloseShiftCardInput`) se arma recién al mandar la
   * request, agregando `tmpPhotoKey` (ver `tmpKey` abajo) — por eso el
   * payload lo guarda sin esa clave. */
  payload: { cardId: string; input: Omit<CloseShiftCardInput, 'tmpPhotoKey'> };
  /** id de la fila en `blobs` — se borra recién cuando el cierre tiene
   * éxito (ver `offline/replay.ts`). */
  photoId: string;
  /** Key `tmp/<userId>/<uuid>.<ext>` YA subida a R2/MinIO — presente solo
   * desde que `status` pasa a `'pending_claim'`. `TMP_KEY_EXPIRED` la limpia
   * y vuelve a `'pending_upload'` para resubir. */
  tmpKey?: string;
}

export interface SendExitReportOp extends OutboxBase {
  type: 'sendExitReport';
  payload: SendExitReportInput;
}

export interface CreateHallazgoOp extends OutboxBase {
  type: 'createHallazgo';
  /** `payload.id` = `id` de la operación = el `id` que ve el backend. */
  payload: CreateHallazgoInput;
  /** id de la fila en `blobs` — ausente cuando el hallazgo no lleva foto
   * (es opcional). Se borra recién cuando el POST tiene éxito. */
  photoId?: string;
  /** Misma semántica que `CloseCardOp#tmpKey`. */
  tmpKey?: string;
}

export interface CreateTrabajoExtraOp extends OutboxBase {
  type: 'createTrabajoExtra';
  payload: CreateTrabajoExtraInput;
}

export interface HttpWriteFile {
  /** Campo del body que recibe la key del archivo ya subido (ej. `fotoKey`). */
  field: string;
  blobId: string;
  /** Key `tmp/<userId>/<uuid>.<ext>` YA subida — ver `CloseCardOp#tmpKey`. */
  tmpKey?: string;
}

/**
 * Escritura genérica contra un endpoint del REGISTRO tipado
 * (`offline/endpoints/`): nunca un método ni una URL libres. `params` arma el
 * path; `body` lleva solo lo que cambió en un PATCH; `expected` viaja como
 * `X-Expected` y es la precondición por campo.
 */
export interface HttpWriteOp extends OutboxBase {
  type: 'httpWrite';
  endpoint: EndpointKey;
  params: Record<string, string>;
  body: JsonObject;
  expected?: JsonObject;
  files?: HttpWriteFile[];
  /** Texto de la hoja de sincronización, armado por el registro al encolar. */
  label: string;
  /** Keys EXTRA a invalidar al terminar, además de las del registro. */
  invalidate?: QueryKeyName[];
  /** El endpoint de la operación CREA su entidad (`entityKey`). Se guarda en la
   * operación para que `opsDeCreacion` no dependa del registro de endpoints, que
   * importa de este archivo. */
  creates?: true;
}

export type OutboxOp =
  | OpenCardOp
  | CloseCardOp
  | SendExitReportOp
  | CreateHallazgoOp
  | CreateTrabajoExtraOp
  | HttpWriteOp;

/** Operaciones que pueden arrastrar una foto por subir — comparten el
 * pipeline `pending_upload` → `pending_claim` de `offline/replay.ts`. */
export type PhotoOp = CloseCardOp | CreateHallazgoOp;

/** Un archivo guardado en el equipo, a la espera de subirse (≤ 8 MB). */
export interface BlobRecord {
  id: string;
  data: ArrayBuffer;
  mime: string;
  name: string;
  createdAt: number;
}

/** Forma de una operación guardada por la versión 1 del schema. */
interface LegacyOp {
  id: string;
  type: string;
  createdAt: number;
  payload?: { cardId?: string };
  [key: string]: unknown;
}

/** Las claves de dependencia que la versión 2 le agrega a una operación vieja. */
function legacyLinks(op: LegacyOp): { entityKey?: string; dependsOn?: string[] } {
  if (op.type === 'openCard') return { entityKey: shiftCardEntity(op.id) };
  if (op.type === 'closeCard' && op.payload?.cardId) {
    return { entityKey: shiftCardEntity(op.payload.cardId), dependsOn: [op.payload.cardId] };
  }
  if (op.type === 'createHallazgo') return { entityKey: hallazgoEntity(op.id) };
  if (op.type === 'createTrabajoExtra') return { entityKey: trabajoExtraEntity(op.id) };
  return {};
}

class SmiOfflineDatabase extends Dexie {
  outbox!: Table<OutboxOp, string>;
  blobs!: Table<BlobRecord, string>;

  constructor() {
    super('smi-offline');
    this.version(1).stores({
      outbox: 'id, [userId+createdAt], status',
      photos: 'id',
    });
    this.version(2)
      .stores({
        // `[userId+seq]`: el índice compuesto que usa el replay para recorrer
        // FIFO SOLO las operaciones del usuario de la sesión (ver
        // `offline/replay.ts`) — un índice separado por `userId` no alcanza
        // porque Dexie no puede ordenar por un segundo campo sin el compuesto.
        // `seq` aparte: para leer la última al asignar la siguiente. `status`:
        // contar/filtrar (ej. `needs_attention`) sin recorrer toda la tabla.
        outbox: 'id, seq, [userId+seq], status, entityKey',
        blobs: 'id',
        photos: null,
      })
      .upgrade(async (tx) => {
        // Lo guardado por la versión 1 se conserva: cada operación recibe su
        // `seq` respetando el orden en que se guardó (los empates de
        // `createdAt` se desempatan) y se enlaza por entidad; las fotos pasan
        // a `blobs` con el mismo id.
        const outbox = tx.table<LegacyOp, string>('outbox');
        const legacy = (await outbox.toArray()).sort((a, b) => a.createdAt - b.createdAt);
        let last = 0;
        for (const op of legacy) {
          last = Math.max(op.createdAt, last + 1);
          await outbox.put({ ...op, seq: last, ...legacyLinks(op) });
        }
        const photos = await tx.table<BlobRecord, string>('photos').toArray();
        await tx.table<BlobRecord, string>('blobs').bulkPut(photos);
      });
  }
}

export const db = new SmiOfflineDatabase();

/** El estado "pendiente" al que vuelve una operación al reintentarla o al
 * fallar con un error transitorio — una operación con foto depende de si ya
 * alcanzó a subirla (`tmpKey` presente) antes de volver a pendiente; sin foto
 * (hallazgo sin adjunto, o cualquier otro tipo) es `'pending'`. Compartida
 * entre `offline/outbox.ts` (acción "Reintentar") y `offline/replay.ts`
 * (errores de red/401), para no repetir la misma regla dos veces. */
export function pendingStatusFor(op: OutboxOp): OutboxStatus {
  if ((op.type === 'closeCard' || op.type === 'createHallazgo') && op.photoId) {
    return op.tmpKey ? 'pending_claim' : 'pending_upload';
  }
  if (op.type === 'httpWrite' && op.files && op.files.length > 0) {
    return op.files.every((f) => f.tmpKey) ? 'pending_claim' : 'pending_upload';
  }
  return 'pending';
}

/** Orden FIFO del replay. */
export function bySeq(a: OutboxOp, b: OutboxOp): number {
  return a.seq - b.seq;
}

/** Las operaciones que dependen de `id`, directa o indirectamente. */
export function dependientesDe(id: string, ops: readonly OutboxOp[]): OutboxOp[] {
  const ids = new Set([id]);
  let crecio = true;
  while (crecio) {
    crecio = false;
    for (const op of ops) {
      if (!ids.has(op.id) && op.dependsOn?.some((d) => ids.has(d))) {
        ids.add(op.id);
        crecio = true;
      }
    }
  }
  return ops.filter((op) => ids.has(op.id) && op.id !== id);
}

/**
 * Lo que se descarta junto con `id`: sus dependientes, salvo el reporte de salida.
 * El reporte cubre varias tarjetas y solo espera a las suyas para no adelantarse;
 * si una de ellas se descarta, el reporte sigue (el servidor avisa qué tarjetas
 * no encontró) en vez de perderse con todas las demás.
 */
export function arrastradasAlDescartar(id: string, ops: readonly OutboxOp[]): OutboxOp[] {
  return dependientesDe(id, ops).filter((op) => op.type !== 'sendExitReport');
}

/**
 * Ids de las operaciones que CREAN (o abren/cierran) la entidad `entityKey`: de
 * ellas depende una edición encolada detrás. Así, descartar la creación desde la
 * hoja de sincronización arrastra la edición en vez de dejarla huérfana con un 404. Una
 * `httpWrite` cuenta solo si su endpoint crea (`creates`): una edición de la
 * misma entidad no es de la que dependa la siguiente.
 */
export function opsDeCreacion(entityKey: string, ops: readonly OutboxOp[]): string[] {
  return ops
    .filter((op) => op.entityKey === entityKey && (op.type !== 'httpWrite' || op.creates === true))
    .map((op) => op.id);
}
