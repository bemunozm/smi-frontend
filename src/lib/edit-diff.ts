import type { JsonObject, JsonValue } from '../types/json';

/**
 * Diferencia entre lo que el usuario ve (la base) y lo que dejó en el
 * formulario, para mandar SOLO lo que cambió y, junto, la precondición
 * (`X-Expected`): el valor base de cada campo tocado. El servidor aplica el
 * cambio solo si el dato sigue como la base — o ya está como se quiere, que es
 * un reintento — y si no responde 409 `STALE_UPDATE` (ver `offline/replay.ts`).
 */

function igual(a: unknown, b: unknown): boolean {
  return JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
}

export interface DiffEdicion<T> {
  /** Solo los campos cambiados, con su valor nuevo. */
  cambios: Partial<T>;
  /** Los mismos campos con el valor base. */
  esperado: Partial<T>;
}

export function diferenciaEdicion<T extends object>(
  base: T,
  nuevo: T,
  campos: readonly (keyof T)[],
): DiffEdicion<T> {
  const cambios: Partial<T> = {};
  const esperado: Partial<T> = {};
  for (const campo of campos) {
    if (igual(base[campo], nuevo[campo])) continue;
    cambios[campo] = nuevo[campo];
    esperado[campo] = base[campo];
  }
  return { cambios, esperado };
}

/**
 * Los valores base de los campos tocados, listos para `X-Expected`. Un campo
 * que estaba vacío viaja como `null` (no `undefined`): si no, desaparecería
 * del header y el servidor no lo compararía.
 */
export function precondicion<T extends { [K in keyof T]?: JsonValue }>(
  esperado: T,
  campos?: readonly string[],
): JsonObject {
  const resultado: JsonObject = {};
  for (const [campo, valor] of Object.entries<JsonValue | undefined>(esperado)) {
    if (!campos || campos.includes(campo)) resultado[campo] = valor ?? null;
  }
  return resultado;
}
