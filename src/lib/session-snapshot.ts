import type { Role } from '../types/roles';
import { isRole } from '../types/roles';
import { safeGet, safeRemove, safeSet } from './local-storage-safe';

const STORAGE_KEY = 'smi-session-snapshot';

/**
 * Snapshot mínimo de la sesión, guardado en `localStorage` — lo único que
 * sobrevive un arranque en frío sin señal (ver `hooks/useCurrentUser.ts`).
 *
 * NUNCA reemplaza la cookie de sesión ni otorga acceso al servidor: el
 * backend sigue exigiéndola para cualquier petición real. Solo existe para
 * que la UI pueda renderizar (rol, nombre) cuando `useSession()` de Better
 * Auth no puede confirmar nada porque no hay red.
 */
export interface SessionSnapshot {
  userId: string;
  name: string;
  email: string;
  role: Role | null;
  /** `Date.now()` de cuándo se guardó — no expira el snapshot (una faena sin
   * señal puede durar más que cualquier TTL razonable), solo sirve para
   * diagnóstico/depuración. */
  savedAt: number;
}

function isSessionSnapshot(value: unknown): value is SessionSnapshot {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.userId === 'string' &&
    typeof candidate.name === 'string' &&
    typeof candidate.email === 'string' &&
    typeof candidate.savedAt === 'number' &&
    (candidate.role === null || typeof candidate.role === 'string')
  );
}

/**
 * Guarda el snapshot ante toda sesión confirmada por el servidor (ver
 * `useCurrentUser`). Best-effort (ver `lib/local-storage-safe.ts`): un
 * snapshot que no se pudo guardar solo significa que el próximo arranque en
 * frío sin señal no tendrá fallback, no un error visible para el usuario.
 */
export function saveSessionSnapshot(snapshot: SessionSnapshot): void {
  safeSet(STORAGE_KEY, snapshot);
}

/** `null` si no hay snapshot, si `localStorage` no está disponible, o si el
 * contenido guardado no calza con el shape esperado (versión vieja, storage
 * corrupto, etc.) — nunca lanza. */
export function readSessionSnapshot(): SessionSnapshot | null {
  const snapshot = safeGet(STORAGE_KEY, isSessionSnapshot);
  if (!snapshot) return null;
  // Re-angosta `role` contra el union `Role` vigente — protege contra un
  // snapshot viejo con un rol que ya no existe.
  return { ...snapshot, role: isRole(snapshot.role ?? undefined) ? snapshot.role : null };
}

/** Se llama desde `logout()` (`lib/logout.ts`) y ante un 401 real del
 * servidor (`useCurrentUser`) — en ambos casos la sesión ya no es válida, así
 * que el snapshot tampoco debe seguir sirviendo de fallback. */
export function clearSessionSnapshot(): void {
  safeRemove(STORAGE_KEY);
}
