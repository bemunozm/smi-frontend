import { z } from 'zod';

import { parseDecimal } from './decimal';

/** Mensaje de un número escrito que no se puede leer (`abc`, `1.234.567`). */
export const NUMERO_INVALIDO = 'Escribe un número: usa coma o punto para los decimales.';

/**
 * Valor de un campo numérico → número para el schema:
 * - texto (input de texto): se lee con `parseDecimal` — un `.` o una `,`
 *   sueltos son el decimal (`12.5` y `12,5` valen 12,5) y sin separador es
 *   entero (`100000`). Vacío → `undefined` («Requerido»); ilegible → `NaN`;
 * - número: tal cual, salvo el `NaN` de un input nativo `valueAsNumber`
 *   vacío, que pasa a `undefined`.
 */
export function leerNumero(v: unknown): unknown {
  if (typeof v === 'string') return v.trim() === '' ? undefined : (parseDecimal(v) ?? Number.NaN);
  return typeof v === 'number' && Number.isNaN(v) ? undefined : v;
}

/** «Requerido» si está vacío; si se escribió algo que no es número, cómo escribirlo. */
const errorDeNumero = (iss: { input?: unknown }) => (iss.input === undefined ? 'Requerido' : NUMERO_INVALIDO);

export const posNumber = (msg = 'Debe ser mayor a 0') =>
  z.preprocess(leerNumero, z.number({ error: errorDeNumero }).positive(msg));

export const nonNegNumber = (msg = 'Valor inválido') =>
  z.preprocess(leerNumero, z.number({ error: errorDeNumero }).nonnegative(msg));

export const optNumber = z.preprocess(leerNumero, z.number({ error: NUMERO_INVALIDO }).optional());
