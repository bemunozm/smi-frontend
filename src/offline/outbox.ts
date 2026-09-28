import { db, pendingStatusFor, type CloseCardOp, type OutboxOp } from './db';
import { compressPhoto } from './photo';
import { requestSync } from './replay';
import type { CloseShiftCardInput, OpenShiftCardInput, SendExitReportInput } from '../types/shift';

function now(): number {
  return Date.now();
}

/**
 * Encola la apertura de una tarjeta. `input.id` (uuid del cliente) ES el id
 * de la operación — el mismo valor que ve el backend, sin mapeo (ver
 * `types/shift.ts#OpenShiftCardInput`). Llamado SIEMPRE desde
 * `hooks/useShiftRegister.ts#abrir`, con o sin señal — un único camino.
 */
export async function enqueueOpenCard(userId: string, input: OpenShiftCardInput): Promise<void> {
  const timestamp = now();
  const op: OutboxOp = {
    id: input.id,
    type: 'openCard',
    v: 1,
    userId,
    payload: input,
    status: 'pending',
    attempts: 0,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  await db.outbox.put(op);
  requestSync();
}

/**
 * Encola el cierre de una tarjeta. Comprime la foto (`offline/photo.ts`)
 * ANTES de abrir la transacción —la compresión no necesita ser atómica con
 * nada—, y guarda la fila de `photos` + la operación en el outbox EN UNA
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
 */
export async function enqueueCloseCard(
  userId: string,
  cardId: string,
  input: Omit<CloseShiftCardInput, 'tmpPhotoKey'>,
  photo: File,
): Promise<void> {
  const compressed = await compressPhoto(photo);
  const photoId = input.closeClientId;
  const timestamp = now();

  await db.transaction('rw', db.outbox, db.photos, async () => {
    await db.photos.put({
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
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    await db.outbox.put(op);
  });
  requestSync();
}

/**
 * Encola el reporte de salida de turno. `input.id` (uuid del cliente) es el
 * id de la operación — mismo criterio que las otras dos.
 */
export async function enqueueExitReport(userId: string, input: SendExitReportInput): Promise<void> {
  const timestamp = now();
  const op: OutboxOp = {
    id: input.id,
    type: 'sendExitReport',
    v: 1,
    userId,
    payload: input,
    status: 'pending',
    attempts: 0,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  await db.outbox.put(op);
  requestSync();
}

/**
 * Reintenta una operación en `needs_attention` (acción "Reintentar" de
 * `SyncStatus`) — vuelve al estado pendiente que le corresponde y limpia el
 * último error, así no queda un mensaje viejo mientras el nuevo intento
 * está en vuelo.
 *
 * `userId` (defensa en profundidad, revisión QA): `SyncStatus` solo lista
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
  // acepta las claves comunes a los tres tipos de operación, y acá hace
  // falta tocar `lastError`, que si vive en un miembro le sobra a los otros
  // dos. Con `put()` y el objeto completo (`...op`) no hay ese problema.
  await db.outbox.put({ ...op, status: pendingStatusFor(op), lastError: undefined, updatedAt: now() });
  requestSync();
}

/**
 * Descarta una operación (acción "Descartar" de `SyncStatus`, con
 * confirmación en la UI) — borra también su foto si es un cierre, para no
 * dejar una fila huérfana en `photos`.
 *
 * Descartar un `openCard` arrastra con él a cualquier `closeCard` que
 * dependa de esa `cardId` (revisión QA — "un cierre cuya apertura falló"):
 * sin la apertura esa tarjeta NUNCA va a existir en el servidor, así que un
 * cierre huérfano solo puede terminar en un 404 `CARD_NOT_FOUND` más
 * adelante. Se borra todo (operaciones + fotos) en UNA transacción — la
 * confirmación en `SyncStatus` avisa esto explícito antes de llamar acá,
 * para que el supervisor sepa que también pierde la foto del cierre.
 *
 * `userId`: ver el comentario de `retryOp`.
 */
export async function discardOp(id: string, userId: string): Promise<void> {
  const op = await db.outbox.get(id);
  if (!op || op.userId !== userId) return;
  await db.transaction('rw', db.outbox, db.photos, async () => {
    if (op.type === 'closeCard') {
      await db.photos.delete(op.photoId);
    }
    if (op.type === 'openCard') {
      const dependientes = await db.outbox
        .where('userId')
        .equals(userId)
        .filter((o): o is CloseCardOp => o.type === 'closeCard' && o.payload.cardId === op.id)
        .toArray();
      await Promise.all(
        dependientes.map(async (dep) => {
          await db.photos.delete(dep.photoId);
          await db.outbox.delete(dep.id);
        }),
      );
    }
    await db.outbox.delete(id);
  });
}

/** Cuántas operaciones (en cualquier estado) tiene pendientes el usuario —
 * usado por el candado de `lib/logout.ts`: un logout con `count > 0` se
 * bloquea. */
export async function countPending(userId: string): Promise<number> {
  return db.outbox.where('userId').equals(userId).count();
}
