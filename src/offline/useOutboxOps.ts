import { db, type OutboxOp } from './db';
import { useLiveQuery } from './useLiveQuery';

const EMPTY_OPS: OutboxOp[] = [];

/**
 * Operaciones del outbox del usuario de la sesión, EN VIVO — la fuente de
 * dos cosas: la proyección offline-first de `hooks/useShiftRegister.ts`
 * (tarjetas pendientes/cierres superpuestos) y los contadores de
 * `offline/replay.ts#useSyncState`. Ordenadas por `createdAt` ascendente,
 * el mismo orden FIFO que usa el replay — así un consumidor que solo
 * necesita "la más vieja primero" no tiene que volver a ordenar.
 *
 * `undefined` (sin sesión resuelta todavía, ej. arranque en frío) devuelve
 * la lista vacía en vez de consultar con un `userId` inválido.
 */
export function useOutboxOps(userId: string | undefined): OutboxOp[] {
  return useLiveQuery(
    () => (userId ? db.outbox.where('userId').equals(userId).sortBy('createdAt') : Promise.resolve(EMPTY_OPS)),
    [userId],
    EMPTY_OPS,
  );
}
