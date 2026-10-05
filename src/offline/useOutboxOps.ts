import { db, type OutboxOp } from './db';
import { useLiveQuery } from './useLiveQuery';

const EMPTY_OPS: OutboxOp[] = [];

/**
 * Operaciones del outbox del usuario de la sesión, EN VIVO — la fuente de
 * dos cosas: la proyección offline-first de `hooks/useShiftRegister.ts`
 * (tarjetas pendientes/cierres superpuestos) y los contadores de
 * `offline/replay.ts#useSyncState`. Ordenadas por `seq` ascendente, el mismo
 * orden FIFO que usa el replay — así "la última edición gana" de las
 * proyecciones coincide con lo que de verdad llegará al servidor, aunque el reloj
 * del equipo retroceda o dos guardados caigan en el mismo milisegundo.
 *
 * `undefined` (sin sesión resuelta todavía, ej. arranque en frío) devuelve
 * la lista vacía en vez de consultar con un `userId` inválido.
 */
export function useOutboxOps(userId: string | undefined): OutboxOp[] {
  return useLiveQuery(
    (id) =>
      id
        ? db.outbox.where('[userId+seq]').between([id, -Infinity], [id, Infinity]).toArray()
        : Promise.resolve(EMPTY_OPS),
    userId,
    EMPTY_OPS,
  );
}

/** Cuántos registros sin enviar tienen otras cuentas en este equipo — solo la
 * cantidad, nunca su contenido. Esas operaciones no se tocan: las envía su dueña
 * cuando vuelve a iniciar sesión. */
export function useOtherAccountsOpCount(userId: string | undefined): number {
  return useLiveQuery(
    (id) => (id ? db.outbox.where('userId').notEqual(id).count() : Promise.resolve(0)),
    userId,
    0,
  );
}
