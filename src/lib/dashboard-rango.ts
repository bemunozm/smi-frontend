import type { RangoDashboard } from '../types/dashboard';
import { toDateOnly } from './turno';
import { inicioSemana } from './horas-semanales';

/** Valor `YYYY-MM` del mes de una fecha (hora local). */
export function mesValue(fecha: Date): string {
  return toDateOnly(fecha).slice(0, 7);
}

/**
 * Rango del dashboard para un mes `YYYY-MM`: del día 1 al fin de mes, pero
 * nunca más allá de hoy (no hay datos del futuro).
 */
export function rangoDeMes(mes: string, hoy: Date = new Date()): RangoDashboard {
  const [y, m] = mes.split('-').map(Number);
  const finDeMes = toDateOnly(new Date(y, m, 0));
  const hoyStr = toDateOnly(hoy);
  return { desde: `${mes}-01`, hasta: finDeMes < hoyStr ? finDeMes : hoyStr };
}

/** Últimos `cantidad` meses (el actual primero) para el selector. */
export function opcionesMes(hoy: Date = new Date(), cantidad = 12): { value: string; label: string }[] {
  return Array.from({ length: cantidad }, (_, i) => {
    const d = new Date(hoy.getFullYear(), hoy.getMonth() - i, 1);
    const label = new Intl.DateTimeFormat('es-CL', { month: 'long', year: 'numeric' }).format(d);
    return { value: mesValue(d), label: label.charAt(0).toUpperCase() + label.slice(1) };
  });
}

/**
 * Rango de las últimas `semanas` semanas: desde el lunes de la semana de
 * `hoy - semanas*7` días hasta hoy (fechas locales, sin `toISOString`).
 */
export function rangoSemanas(semanas: number, hoy: Date = new Date()): RangoDashboard {
  const base = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() - semanas * 7);
  return { desde: inicioSemana(toDateOnly(base)), hasta: toDateOnly(hoy) };
}
