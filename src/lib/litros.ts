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
 * Cómo leer el medidor, para la ayuda de los campos de litros. En faena hay dos:
 * el surtidor digital (punto decimal: `48.493`) y el contador de ruedas, sin punto,
 * donde la última rueda son los décimos (`0 1 3 4 8` = 134,8 L; caso real de
 * SEM 06 el 13/11, registrado como 1340).
 */
export const AYUDA_LITROS =
  'Surtidor digital: 48.493 son 48,493 L. Contador de ruedas: la última es el decimal (01348 son 134,8 L).';

/**
 * Lecturas que probablemente se quisieron escribir, dentro del tope: el display
 * digital sin la coma (÷ 1.000) o el contador de ruedas sin el decimal (÷ 10).
 */
export function litrosSugeridos(valor: number, tope: number): { digital: number | null; ruedas: number | null } {
  if (valor < 1_000) return { digital: null, ruedas: null };
  const digital = valor / 1_000;
  const ruedas = valor / 10;
  return { digital: digital >= 1 && digital <= tope ? digital : null, ruedas: ruedas <= tope ? ruedas : null };
}

function mensajeSugerencia(valor: number, tope: number): string {
  const { digital, ruedas } = litrosSugeridos(valor, tope);
  const opciones = [
    digital != null ? `${formatDecimalInput(digital, 3)} si es un surtidor digital (el punto es la coma)` : null,
    ruedas != null ? `${formatDecimalInput(ruedas, 1)} si es un contador de ruedas (la última es el decimal)` : null,
  ].filter((o): o is string => o != null);
  if (opciones.length === 0) return 'En el surtidor el punto es la coma: escribe por ejemplo 48,493.';
  return `Escribe ${opciones.join(', o ')}.`;
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
    return { error: `${enTexto} L no cabe en una camioneta. ${mensajeSugerencia(valor, LITROS_MAX_LIVIANO)}`, aviso: null };
  }
  if (!liviano && valor > LITROS_MAX_PESADO) {
    return { error: `${enTexto} L es más de lo que carga un equipo. ${mensajeSugerencia(valor, LITROS_MAX_PESADO)}`, aviso: null };
  }
  return { error: null, aviso: null };
}
