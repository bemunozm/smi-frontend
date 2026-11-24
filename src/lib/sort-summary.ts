import { describeSort, type SortMeta } from './sort-description';
import type { TableSort } from './table-sort';

const TAIL = 'Toca el título de una columna para cambiar el orden.';

/**
 * Bajada de una lista ordenable con la misma redacción que `describeSort`
 * («Ordenado por fecha, del más reciente al más antiguo.») más la invitación a
 * tocar el título. `sort === null` = el orden por defecto de la vista, que se
 * describe con `defaultText` (ej. «por código»).
 */
export function sortSummary(sort: TableSort | null, options: readonly SortMeta[], defaultText: string): string {
  const description = sort ? describeSort(sort, options) : '';
  return `${description || `Ordenado ${defaultText}.`} ${TAIL}`;
}
