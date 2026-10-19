import type { MetricasEquipo } from '../types/dashboard';
import { fromDateOnly, toDateOnly } from './turno';

/** Fila lista para Recharts: `semana` (dd/mm del lunes) + una columna por equipo. */
export type FilaSemanal = { semana: string; semanaInicio: string } & Record<string, number | string>;

export interface HorasSemanales {
  filas: FilaSemanal[];
  /** Códigos internos con actividad (> 0 horas en todo el rango), en orden de aparición. */
  codigos: string[];
}

/** Lunes (`YYYY-MM-DD`) de la semana ISO que contiene a `fecha` (`YYYY-MM-DD`). Partes locales, sin UTC. */
export function inicioSemana(fecha: string): string {
  const d = fromDateOnly(fecha);
  const diasDesdeLunes = (d.getDay() + 6) % 7; // domingo (0) -> 6, lunes (1) -> 0
  return toDateOnly(new Date(d.getFullYear(), d.getMonth(), d.getDate() - diasDesdeLunes));
}

function sumarDias(fecha: string, dias: number): string {
  const d = fromDateOnly(fecha);
  return toDateOnly(new Date(d.getFullYear(), d.getMonth(), d.getDate() + dias));
}

const ddmm = (fecha: string) => `${fecha.slice(8, 10)}/${fecha.slice(5, 7)}`;

/**
 * Agrupa la `serieDiaria` de cada equipo en semanas ISO (inicio lunes) y suma
 * las horas por equipo y semana. Las semanas son continuas entre la primera y
 * la última con datos; un equipo sin horas en una semana vale 0.
 *
 * Los equipos con 0 horas en TODO el rango se EXCLUYEN de `codigos` (y de las
 * filas): serían una línea plana en 0 que sólo agrega ruido a la leyenda.
 */
export function horasSemanales(equipos: MetricasEquipo[]): HorasSemanales {
  const porEquipo = new Map<string, Map<string, number>>();
  let min: string | null = null;
  let max: string | null = null;

  for (const equipo of equipos) {
    const semanas = porEquipo.get(equipo.internalCode) ?? new Map<string, number>();
    porEquipo.set(equipo.internalCode, semanas);
    for (const dia of equipo.serieDiaria) {
      const lunes = inicioSemana(dia.fecha);
      semanas.set(lunes, (semanas.get(lunes) ?? 0) + dia.horas);
      if (min === null || lunes < min) min = lunes;
      if (max === null || lunes > max) max = lunes;
    }
  }

  const codigos = [...porEquipo.entries()]
    .filter(([, semanas]) => [...semanas.values()].reduce((a, b) => a + b, 0) > 0)
    .map(([codigo]) => codigo);

  const filas: FilaSemanal[] = [];
  if (min !== null && max !== null && codigos.length > 0) {
    for (let lunes = min; lunes <= max; lunes = sumarDias(lunes, 7)) {
      const fila: FilaSemanal = { semana: ddmm(lunes), semanaInicio: lunes };
      for (const codigo of codigos) {
        fila[codigo] = Math.round((porEquipo.get(codigo)?.get(lunes) ?? 0) * 100) / 100;
      }
      filas.push(fila);
    }
  }
  return { filas, codigos };
}
