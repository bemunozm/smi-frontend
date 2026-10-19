/** Meses del calendario de vencimientos (`YYYY-MM`), en palabras. */

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const MESES_LARGOS = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
];

/** `2026-10` → «oct 26». */
export const mesCorto = (m: string) => `${MESES[Number(m.slice(5, 7)) - 1]} ${m.slice(2, 4)}`;
/** `2026-10` → «octubre 2026». */
export const mesLargo = (m: string) => `${MESES_LARGOS[Number(m.slice(5, 7)) - 1]} ${m.slice(0, 4)}`;
/** `2026-11-08` → «08-11-2026». */
export const fecha = (d: string) => d.split('-').reverse().join('-');

/** Mueve un `YYYY-MM` n meses. */
export function mover(mes: string, n: number): string {
  const [y, m] = mes.split('-').map(Number);
  const total = y * 12 + (m - 1) + n;
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, '0')}`;
}
