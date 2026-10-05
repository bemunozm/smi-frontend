import { safeGet, safeRemove, safeSet } from './local-storage-safe';

const OWNER_KEY = 'smi-cache-owner';

/** Marca de "la sesión terminó por vencimiento o 401": la caché que quedó era de
 * esa sesión y no se la debe servir a la siguiente, sea quien sea. */
const SESSION_ENDED = '';

function isString(value: unknown): value is string {
  return typeof value === 'string';
}

/**
 * De quién son los datos que hay en las cachés del equipo (la de TanStack Query y
 * las del Service Worker). Vive aparte de `lib/session-data.ts` para que
 * `lib/query-client.ts` pueda marcar el fin de una sesión sin importar la
 * instancia del cliente de queries.
 */
export function readCacheOwner(): string | null {
  return safeGet(OWNER_KEY, isString);
}

/** `true` si las cachés son de otra sesión: otro usuario, o la misma que terminó. */
export function isCacheOwnerMismatch(userId: string): boolean {
  const owner = readCacheOwner();
  return owner !== null && owner !== userId;
}

export function writeCacheOwner(userId: string): void {
  safeSet(OWNER_KEY, userId);
}

/** Las cachés quedaron vacías (cierre de sesión): no son de nadie. */
export function clearCacheOwner(): void {
  safeRemove(OWNER_KEY);
}

/** Registra que la sesión terminó sin pasar por "Cerrar sesión" (401, vencimiento). */
export function markSessionEnded(): void {
  safeSet(OWNER_KEY, SESSION_ENDED);
}
