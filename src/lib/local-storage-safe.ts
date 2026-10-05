/**
 * Wrappers genéricos de `localStorage` — best-effort: `localStorage` puede
 * fallar (cuota, navegación privada de Safari) o el contenido guardado
 * puede no calzar con el shape esperado (versión vieja, storage corrupto).
 * Ninguno de los dos casos debe romper la pantalla ni lanzar — solo
 * significa que el fallback no está disponible esta vez.
 *
 * Usado por `lib/session-snapshot.ts` y `lib/shift-turno-override.ts`, que
 * antes repetían la misma pareja try/catch + type guard cada una.
 */

/** `null` si no hay valor guardado, si `localStorage` no está disponible, o
 * si el contenido no pasa `isValid` (versión vieja, storage corrupto) —
 * nunca lanza. */
export function safeGet<T>(key: string, isValid: (value: unknown) => value is T): T | null {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return isValid(parsed) ? parsed : null;
  } catch (error) {
    console.error(`No se pudo leer "${key}" de localStorage:`, error);
    return null;
  }
}

/** Guarda `value` serializado. Silencioso ante error — quien llama no
 * necesita (ni puede) reaccionar a una cuota llena. */
export function safeSet<T>(key: string, value: T): void {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.error(`No se pudo guardar "${key}" en localStorage:`, error);
  }
}

export function safeRemove(key: string): void {
  try {
    window.localStorage.removeItem(key);
  } catch (error) {
    console.error(`No se pudo limpiar "${key}" de localStorage:`, error);
  }
}
