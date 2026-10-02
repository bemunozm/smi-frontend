import Dexie, { type Table } from 'dexie';

import type { CreateHallazgoInput } from '../types/hallazgos';
import type { CloseShiftCardInput, OpenShiftCardInput, SendExitReportInput } from '../types/shift';
import type { CreateTrabajoExtraInput } from '../types/trabajosExtra';

/**
 * Base de datos offline del Módulo A (RFC "Supervisión en Terreno" §Diseño
 * → Offline). Dos tablas:
 * - `outbox`: cola de operaciones pendientes de sincronizar (abrir/cerrar
 *   tarjeta, mandar reporte de salida, crear hallazgo / trabajo extra). Una operación TERMINADA se BORRA —
 *   no existe un estado `'done'`, ver `offline/replay.ts`.
 * - `photos`: la foto de cierre (o del hallazgo), guardada como `ArrayBuffer` (no `Blob`):
 *   el soporte de Blob en IndexedDB de Safari/iOS ha sido históricamente
 *   poco confiable, así que se evita del todo.
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
  | 'createTrabajoExtra';

/**
 * `'pending'`/`'pending_upload'`/`'pending_claim'`: esperando su turno en el
 * outbox (ver el detalle por tipo abajo). `'syncing'`: el replay la tiene en
 * vuelo AHORA MISMO — evita que un segundo trigger la vuelva a tomar si el
 * primero todavía no terminó de escribir el resultado. `'needs_attention'`:
 * el servidor la rechazó por una razón de NEGOCIO (no de red) — queda
 * visible en `SyncStatus` con Reintentar/Descartar.
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
  lastError?: OutboxLastError;
  /** `Date.now()` — define el orden FIFO del replay (`[userId+createdAt]`). */
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
  /** id de la fila en `photos` — se borra recién cuando el cierre tiene
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
  /** id de la fila en `photos` — ausente cuando el hallazgo no lleva foto
   * (es opcional). Se borra recién cuando el POST tiene éxito. */
  photoId?: string;
  /** Misma semántica que `CloseCardOp#tmpKey`. */
  tmpKey?: string;
}

export interface CreateTrabajoExtraOp extends OutboxBase {
  type: 'createTrabajoExtra';
  payload: CreateTrabajoExtraInput;
}

export type OutboxOp = OpenCardOp | CloseCardOp | SendExitReportOp | CreateHallazgoOp | CreateTrabajoExtraOp;

/** Operaciones que pueden arrastrar una foto por subir — comparten el
 * pipeline `pending_upload` → `pending_claim` de `offline/replay.ts`. */
export type PhotoOp = CloseCardOp | CreateHallazgoOp;

export interface PhotoRecord {
  id: string;
  data: ArrayBuffer;
  mime: string;
  name: string;
  createdAt: number;
}

class SmiOfflineDatabase extends Dexie {
  outbox!: Table<OutboxOp, string>;
  photos!: Table<PhotoRecord, string>;

  constructor() {
    super('smi-offline');
    this.version(1).stores({
      // `[userId+createdAt]`: el índice compuesto que usa el replay para
      // recorrer FIFO SOLO las operaciones del usuario de la sesión (ver
      // `offline/replay.ts`) — un índice separado por `userId` no alcanza
      // porque Dexie no puede ordenar por un segundo campo sin el compuesto.
      // `status` aparte: para contar/filtrar (ej. `needs_attention` en
      // `SyncStatus`) sin recorrer toda la tabla.
      outbox: 'id, [userId+createdAt], status',
      photos: 'id',
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
  return 'pending';
}
