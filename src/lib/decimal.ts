/**
 * Números escritos a mano en un formulario.
 *
 * No hay separador de miles: un `.` o una `,` sueltos son SIEMPRE el separador
 * decimal. Tratar el punto como agrupador convertía `12.5` en 125 en cuanto el
 * teclado de la tablet ofrecía el punto en vez de la coma. Si vienen los dos, el
 * último es el decimal y el otro se descarta como agrupador (`1.234,5` y
 * `1,234.5` valen lo mismo). Repetir el mismo separador (`1.234.567`) es
 * ambiguo y no se adivina: no es un número.
 */

const CARACTERES_NUMERICOS = /^-?[\d.,]+$/;

/** `1.234` o `12.345.678`: grupos de tres dígitos tras el primero. */
function esParteEnteraAgrupada(entera: string, agrupador: string): boolean {
  const grupos = entera.replace(/^-/, '').split(agrupador);
  return grupos.every((grupo, i) => (i === 0 ? /^\d{1,3}$/.test(grupo) : /^\d{3}$/.test(grupo)));
}

/** `"12.5"`, `"12,5"` → `12.5`; `"abc"`, `""` → `null`. */
export function parseDecimal(texto: string): number | null {
  const limpio = texto.trim();
  if (!CARACTERES_NUMERICOS.test(limpio)) return null;

  const ultimoPunto = limpio.lastIndexOf('.');
  const ultimaComa = limpio.lastIndexOf(',');
  let normalizado: string;

  if (ultimoPunto >= 0 && ultimaComa >= 0) {
    const decimal = ultimoPunto > ultimaComa ? '.' : ',';
    const agrupador = decimal === '.' ? ',' : '.';
    const [entera, fraccion, ...resto] = limpio.split(decimal);
    if (resto.length > 0 || fraccion === undefined || fraccion.includes(agrupador)) return null;
    if (!esParteEnteraAgrupada(entera, agrupador)) return null;
    normalizado = `${entera.split(agrupador).join('')}.${fraccion}`;
  } else {
    const separador = ultimoPunto >= 0 ? '.' : ',';
    const partes = limpio.split(separador);
    if (partes.length > 2) return null;
    normalizado = partes.join('.');
  }

  const valor = Number(normalizado);
  return Number.isFinite(valor) ? valor : null;
}

const PARECE_AGRUPADO = /^[1-9]\d{0,2}[.,]\d{3}$/;

/**
 * Aviso para un texto que parece un valor con separador de miles (`2.130`,
 * `2,130`): como un `.` o una `,` sueltos son el decimal, se leería `2,13`. No
 * bloquea; dice cómo se leerá y cómo escribir el otro valor. `null` si el texto no
 * tiene ese aspecto.
 */
export function avisoDeAgrupacion(texto: string): string | null {
  const limpio = texto.trim();
  if (!PARECE_AGRUPADO.test(limpio)) return null;
  const leido = parseDecimal(limpio);
  if (leido == null) return null;
  return `Se guardará ${formatDecimalInput(leido, 3)}. Si querías ${limpio.replace(/[.,]/, '')}, escribilo sin punto ni coma.`;
}

/**
 * Número → texto de un campo de formulario, con coma decimal y sin miles: lo
 * que `parseDecimal` vuelve a leer sin cambiar el valor.
 */
export function formatDecimalInput(valor: number | null | undefined, maxDecimales = 2): string {
  if (valor == null || !Number.isFinite(valor)) return '';
  return valor.toLocaleString('es-CL', { useGrouping: false, maximumFractionDigits: maxDecimales });
}
