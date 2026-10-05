import { useSyncExternalStore } from 'react';

import { safeGet, safeRemove, safeSet } from './local-storage-safe';

/**
 * Si hay una sesión válida en este equipo. Una sola fuente de verdad con dos valores:
 * - `'closed'`: la persona salió. Hasta que alguien inicie sesión de verdad, nada
 *   escribe ni lee el snapshot de la sesión y `useCurrentUser` dice "sin sesión", aunque
 *   Better Auth todavía tenga en memoria al usuario anterior.
 * - `'server-pending'`: además, el servidor no llegó a cerrar la sesión (sin señal). La
 *   cookie es `HttpOnly`: el JavaScript de la página no puede borrarla, solo el servidor
 *   la revoca (`signOut`). Mientras esté este valor la app no consulta la sesión
 *   (`lib/auth-client.ts`), o la cookie viva reabriría la sesión de quien se fue para
 *   quien use el equipo después. Pasa a `'closed'` solo cuando el servidor confirma
 *   (`lib/server-signout.ts`).
 * Sin valor: hay (o puede haber) una sesión.
 */
type SessionClosedState = 'closed' | 'server-pending';

const KEY = 'smi-session-closed';
const listeners = new Set<() => void>();

function isState(value: unknown): value is SessionClosedState {
  return value === 'closed' || value === 'server-pending';
}

function read(): SessionClosedState | null {
  return safeGet(KEY, isState);
}

function notify(): void {
  for (const listener of listeners) listener();
}

export function isSessionClosed(): boolean {
  return read() !== null;
}

export function isServerSignOutPending(): boolean {
  return read() === 'server-pending';
}

/** La persona salió: sin sesión en este equipo hasta el próximo inicio de sesión real. */
export function markSessionClosed(): void {
  if (read() !== 'server-pending') safeSet(KEY, 'closed');
  notify();
}

/** Además de cerrada, falta que el servidor revoque la cookie. */
export function markServerSignOutPending(): void {
  safeSet(KEY, 'server-pending');
  notify();
}

/** El servidor confirmó el cierre: la sesión sigue cerrada en el equipo. */
export function clearServerSignOutPending(): void {
  if (read() === 'server-pending') safeSet(KEY, 'closed');
  notify();
}

/** Un inicio de sesión exitoso: vuelve a haber una sesión válida. */
export function clearSessionClosed(): void {
  safeRemove(KEY);
  notify();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** `true` mientras no hay sesión válida en el equipo; re-renderiza al cambiar. */
export function useSessionClosed(): boolean {
  return useSyncExternalStore(subscribe, isSessionClosed, () => false);
}
