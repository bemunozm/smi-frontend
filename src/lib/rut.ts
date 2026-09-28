/**
 * Validación de RUT chileno (dígito verificador módulo 11) — espejo
 * byte-a-byte de `smi-backend/src/operators/rut.ts` (`IsChileanRut`, DTO de
 * Operadores): mismo regex de forma, mismo algoritmo de dígito verificador.
 * Funciones puras, sin dependencias — se usan tanto en la validación del
 * formulario (`types/operator.ts`, Zod `.refine`) como para normalizar el
 * payload antes de mandarlo al backend.
 */

const NON_RUT_CHARS_REGEX = /[.\s-]/g;
const RUT_SHAPE_REGEX = /^\d{7,8}[0-9K]$/;

/** Quita puntos/espacios/guion y pasa la "k" a mayúscula. No valida forma. */
function clean(raw: string): string {
  return raw.replace(NON_RUT_CHARS_REGEX, '').toUpperCase();
}

/** Dígito verificador módulo 11, algoritmo estándar del RUT chileno. */
function computeCheckDigit(body: string): string {
  let sum = 0;
  let multiplier = 2;
  for (let i = body.length - 1; i >= 0; i -= 1) {
    sum += Number(body[i]) * multiplier;
    multiplier = multiplier === 7 ? 2 : multiplier + 1;
  }
  const remainder = 11 - (sum % 11);
  if (remainder === 11) return '0';
  if (remainder === 10) return 'K';
  return String(remainder);
}

/**
 * `true` si `raw` es un RUT chileno con dígito verificador correcto. Tolera
 * puntos/guion/espacios y mayúsculas/minúsculas en la "k" — NO exige el
 * formato canónico de entrada (eso lo resuelve `normalizeRut`). El cuerpo
 * debe tener 7 u 8 dígitos (rango real de RUT chileno), igual que el backend.
 */
export function isValidRut(raw: string): boolean {
  const value = clean(raw);
  if (!RUT_SHAPE_REGEX.test(value)) return false;

  const body = value.slice(0, -1);
  const checkDigit = value.slice(-1);
  return computeCheckDigit(body) === checkDigit;
}

/**
 * Normaliza un RUT a `12345678-K` (mismo formato que persiste el backend) —
 * `null` si `raw` no es un RUT válido (a diferencia del backend, que lanza:
 * acá conviene un valor "sin match" para que el caller decida qué mostrar,
 * en vez de encadenar un try/catch en cada sitio de uso).
 */
export function normalizeRut(raw: string): string | null {
  if (!isValidRut(raw)) return null;
  const value = clean(raw);
  return `${value.slice(0, -1)}-${value.slice(-1)}`;
}
