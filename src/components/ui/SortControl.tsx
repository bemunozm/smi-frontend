import { Button } from '@heroui/react';
import { ArrowDown, ArrowUp } from 'lucide-react';

import type { TableSort } from '../../lib/table-sort';

export interface SortOption {
  id: string;
  label: string;
}

/**
 * «Ordenar por» para el celular y la tablet, donde la lista se ve en tarjetas
 * (sin títulos de columna que tocar). Comparte el estado de orden con la
 * tabla: el selector elige la columna y el botón invierte el sentido.
 */
export function SortControl({
  options,
  sort,
  onChange,
}: {
  options: SortOption[];
  sort: TableSort;
  onChange: (sort: TableSort) => void;
}) {
  const ascendente = sort.direction === 'ascending';
  return (
    <div className="mb-3 flex items-center gap-2">
      <label className="flex min-w-0 flex-1 items-center gap-2 text-sm text-muted-foreground">
        <span className="shrink-0">Ordenar por</span>
        <select
          className="min-w-0 flex-1 rounded-lg border border-border bg-surface px-3 py-1.5 text-sm text-foreground"
          data-testid="orden-columna"
          onChange={(event) => onChange({ column: event.target.value, direction: sort.direction })}
          value={String(sort.column)}
        >
          {options.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
      <Button
        aria-label={ascendente ? 'Orden ascendente, tocar para descendente' : 'Orden descendente, tocar para ascendente'}
        data-testid="orden-direccion"
        isIconOnly
        onPress={() => onChange({ column: sort.column, direction: ascendente ? 'descending' : 'ascending' })}
        size="sm"
        variant="secondary"
      >
        {ascendente ? <ArrowUp aria-hidden size={16} /> : <ArrowDown aria-hidden size={16} />}
      </Button>
    </div>
  );
}
