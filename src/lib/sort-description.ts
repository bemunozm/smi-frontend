import type { SortOption } from '../components/ui/SortControl';
import type { TableSort } from './table-sort';

/** Cómo se lee el sentido de una columna: texto, número, fecha o un par propio [ascendente, descendente]. */
export type SortReading = 'text' | 'number' | 'date' | readonly [string, string];

/** Opción del «Ordenar por» con la forma de leer su sentido (para la bajada de la tabla). */
export interface SortMeta extends SortOption {
  reading: SortReading;
}

const READINGS: Record<'text' | 'number' | 'date', readonly [string, string]> = {
  text: ['de la A a la Z', 'de la Z a la A'],
  number: ['de menor a mayor', 'de mayor a menor'],
  date: ['del más antiguo al más reciente', 'del más reciente al más antiguo'],
};

/**
 * Frase para la bajada de la tabla: «Ordenado por Fecha, del más reciente al
 * más antiguo.» Si la columna no está entre las opciones, no dice nada.
 */
export function describeSort(sort: TableSort, options: readonly SortMeta[]): string {
  const option = options.find((o) => o.id === String(sort.column));
  if (!option) return '';
  const pair = typeof option.reading === 'string' ? READINGS[option.reading] : option.reading;
  const phrase = sort.direction === 'ascending' ? pair[0] : pair[1];
  return `Ordenado por ${option.label.toLowerCase()}, ${phrase}.`;
}
