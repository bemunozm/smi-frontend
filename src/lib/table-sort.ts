/**
 * Orden de tablas del panel: comparadores reutilizables (texto es-CL, número,
 * fecha) y `sortRows`, que aplica un orden por columna dejando SIEMPRE los
 * valores vacíos al final (en ascendente y en descendente). Sin dependencias
 * de React: se prueba solo.
 */

export type SortDirection = 'ascending' | 'descending';

/** Mismo contrato que `SortDescriptor` de react-aria (`column` = `id` de la columna). */
export interface TableSort {
  column: string | number;
  direction: SortDirection;
}

type SortValue = string | number | null | undefined;

export interface SortColumn<T> {
  /** Valor de la fila para esta columna. `null`/`undefined`/vacío van al final. */
  value: (row: T) => SortValue;
  /** `date` recibe un ISO (`YYYY-MM-DD` o con hora). */
  kind: 'text' | 'number' | 'date';
  /** Desempate en sentido ascendente; sigue la dirección elegida. */
  tiebreak?: (a: T, b: T) => number;
}

const COLLATOR = new Intl.Collator('es-CL', { sensitivity: 'base', numeric: true });

export function compareText(a: string, b: string): number {
  return COLLATOR.compare(a, b);
}

export function compareNumber(a: number, b: number): number {
  return a - b;
}

/** Instante de un ISO, o `null` si no se puede leer. */
export function toTimestamp(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const ms = Date.parse(iso);
  return Number.isNaN(ms) ? null : ms;
}

export function compareDate(a: string, b: string): number {
  return (toTimestamp(a) ?? 0) - (toTimestamp(b) ?? 0);
}

/** Normaliza el valor según el tipo de columna; `null` = vacío. */
function normalize(value: SortValue, kind: SortColumn<unknown>['kind']): string | number | null {
  if (value === null || value === undefined) return null;
  if (kind === 'date') return typeof value === 'string' ? toTimestamp(value) : null;
  if (kind === 'number') {
    const n = typeof value === 'number' ? value : Number(String(value).trim().replace(',', '.'));
    return String(value).trim() === '' || Number.isNaN(n) ? null : n;
  }
  const text = String(value).trim();
  return text === '' ? null : text;
}

/** Devuelve una copia ordenada; sin columna conocida, devuelve la copia tal cual. */
export function sortRows<T>(rows: readonly T[], sort: TableSort, columns: Record<string, SortColumn<T>>): T[] {
  const column = columns[String(sort.column)];
  const copy = [...rows];
  if (!column) return copy;
  const sign = sort.direction === 'ascending' ? 1 : -1;

  return copy.sort((a, b) => {
    const va = normalize(column.value(a), column.kind);
    const vb = normalize(column.value(b), column.kind);
    // Vacíos al final, sin importar el sentido.
    if (va === null && vb === null) return sign * (column.tiebreak?.(a, b) ?? 0);
    if (va === null) return 1;
    if (vb === null) return -1;

    const main =
      typeof va === 'number' && typeof vb === 'number'
        ? compareNumber(va, vb)
        : compareText(String(va), String(vb));
    if (main !== 0) return sign * main;
    return sign * (column.tiebreak?.(a, b) ?? 0);
  });
}

/** Alterna el sentido al tocar la misma columna; una columna nueva parte ascendente. */
export function nextSort(current: TableSort, column: string): TableSort {
  if (String(current.column) === column) {
    return { column, direction: current.direction === 'ascending' ? 'descending' : 'ascending' };
  }
  return { column, direction: 'ascending' };
}
