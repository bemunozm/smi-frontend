import { formatDecimalInput, parseDecimal } from './decimal';

/**
 * Litros de una carga de combustible.
 *
 * El surtidor muestra los litros con PUNTO decimal y tres decimales
 * (`48.493` = 48 litros y medio). En la app un `.` o una `,` sueltos ya son el
 * decimal (`parseDecimal`), así que `48.493` se lee bien. El error que se
 * repetía era otro: el aviso genérico de «¿querías 48493?» empujaba a sacar el
 * punto, y una carga quedaba en 48.493 litros. Para litros no hay miles
 * posibles en una carga de un equipo, y aquí se detectan esos valores.
 */

/** Tope del servidor (`CloseShiftCardDto.fuelLiters`): cargas de estanque incluidas. */
export const LITROS_MAX = 100_000;

/** Ninguna camioneta carga más que esto en una carga: sobre esto no se guarda. */
export const LITROS_MAX_LIVIANO = 200;

/** Ningún pesado de la faena carga más que esto (rondan los 500 L; margen hasta 1.000). */
export const LITROS_MAX_PESADO = 1_000;

export const LITROS_FUERA_DE_RANGO =
  'Los litros van de 0 a 100.000. Revisa que no sea el kilometraje u horómetro.';

/**
 * Lo que probablemente se quiso escribir: un valor de miles sin decimal
 * (`48493`, `48.493,0`…) es casi siempre el display del surtidor sin la coma.
 * `null` si no hay una lectura alternativa razonable.
 */
export function litrosSugeridos(valor: number): number | null {
  if (valor < 1_000) return null;
  const sugerido = valor / 1_000;
  return sugerido >= 1 ? sugerido : null;
}

function mensajeSugerencia(valor: number): string {
  const sugerido = litrosSugeridos(valor);
  const ejemplo = sugerido != null ? formatDecimalInput(sugerido, 3) : '48,493';
  return `En el surtidor el punto es la coma: escribe ${ejemplo}.`;
}

export interface ValidacionLitros {
  /** Los litros leídos; `null` si está vacío o no es un número. */
  valor: number | null;
  /** No se puede guardar así. */
  error: string | null;
  /** Se puede guardar, pero conviene revisarlo. */
  aviso: string | null;
}

/**
 * Valida los litros escritos para un equipo. `liviano` decide el tope: 200 L en
 * una camioneta, 1.000 L en un pesado (definidos por Joaquín, 13/11). Sobre el
 * tope no se guarda y el mensaje dice cómo escribirlo.
 */
export function validarLitros(texto: string, { liviano }: { liviano: boolean }): ValidacionLitros {
  const limpio = texto.trim();
  if (limpio === '') return { valor: null, error: null, aviso: null };
  const valor = parseDecimal(limpio);
  if (valor == null) {
    return { valor: null, error: 'Escribe un número, por ejemplo 48,493 (como en el surtidor).', aviso: null };
  }
  return { valor, ...revisarLitros(valor, { liviano }) };
}

/** Lo mismo que `validarLitros`, para un formulario que ya guarda los litros como número. */
export function revisarLitros(valor: number, { liviano }: { liviano: boolean }): Omit<ValidacionLitros, 'valor'> {
  if (!Number.isFinite(valor)) return { error: null, aviso: null };
  if (valor < 0 || valor > LITROS_MAX) return { error: LITROS_FUERA_DE_RANGO, aviso: null };
  const enTexto = valor.toLocaleString('es-CL', { maximumFractionDigits: 3 });
  if (liviano && valor > LITROS_MAX_LIVIANO) {
    return { error: `${enTexto} L no cabe en una camioneta. ${mensajeSugerencia(valor)}`, aviso: null };
  }
  if (!liviano && valor > LITROS_MAX_PESADO) {
    return { error: `${enTexto} L es más de lo que carga un equipo. ${mensajeSugerencia(valor)}`, aviso: null };
  }
  return { error: null, aviso: null };
}
