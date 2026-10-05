import { useSyncExternalStore } from 'react';

import { safeGet, safeRemove, safeSet } from './local-storage-safe';

const KEY = 'smi-server-signout-pending';

/**
 * "Falta cerrar la sesión en el servidor". La cookie de sesión es `HttpOnly`: el
 * JavaScript de la página no puede borrarla, solo el servidor la revoca (`signOut`).
 * Si la persona sale sin conexión, el cierre se completa en el equipo y esta marca
 * recuerda que la cookie sigue viva: mientras exista, la app no consulta la sesión
 * ni usa el snapshot, o la cookie reabriría la sesión de quien se fue para quien use
 * el equipo después. Se borra solo cuando el servidor confirma el cierre
 * (`lib/server-signout.ts`).
 */
const listeners = new Set<() => void>();

function isTrue(value: unknown): value is true {
  return value === true;
}

export function isServerSignOutPending(): boolean {
  return safeGet(KEY, isTrue) === true;
}

function notify(): void {
  for (const listener of listeners) listener();
}

export function markServerSignOutPending(): void {
  safeSet(KEY, true);
  notify();
}

export function clearServerSignOutPending(): void {
  safeRemove(KEY);
  notify();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** `true` mientras el cierre en el servidor está pendiente; re-renderiza al cambiar. */
export function useServerSignOutPending(): boolean {
  return useSyncExternalStore(subscribe, isServerSignOutPending, () => false);
}
