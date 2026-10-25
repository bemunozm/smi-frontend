import type { MaintenanceForecastRow } from '../types/maintenance-forecast';
import { fmtNum } from './format';

const DIAS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];

/** `2026-10-30` → «vie 30-10». */
export function diaCorto(dia: string): string {
  const [y, m, d] = dia.split('-').map(Number);
  return `${DIAS[new Date(y, m - 1, d).getDay()]} ${dia.slice(8, 10)}-${dia.slice(5, 7)}`;
}

/**
 * Qué decir de la fecha estimada, en una línea corta (lista de Equipos, chips
 * del calendario). `null` cuando no hay nada útil que agregar.
 */
export function lineaPronostico(f: MaintenanceForecastRow): string | null {
  switch (f.status) {
    case 'ESTIMADA':
      return f.suggestedDate
        ? `≈ ${diaCorto(f.estimatedDate!)} · mejor ${diaCorto(f.suggestedDate)}`
        : `≈ ${diaCorto(f.estimatedDate!)}`;
    case 'FALTAN_DATOS':
      return 'Fecha: faltan registros de uso';
    case 'SIN_USO':
      return 'Sin uso en 4 semanas';
    case 'LEJANA':
      return 'Fecha: en más de un año';
    case 'TOCA_AHORA':
      return null;
  }
}

/** «a ~85 km/día (últimos 28 días)». */
export function ritmo(f: MaintenanceForecastRow): string | null {
  if (f.dailyUsage == null) return null;
  return `a ~${fmtNum(f.dailyUsage)} ${f.unit}/día${f.basedOnDays ? ` (últimos ${f.basedOnDays} días)` : ''}`;
}
