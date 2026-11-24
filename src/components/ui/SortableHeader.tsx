import { Table } from '@heroui/react';
import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';

type SortDirection = 'ascending' | 'descending';

/**
 * Título de columna ordenable (pedido del cliente, 20/11/2026): todas las
 * columnas que ordenan muestran unas flechas tenues para que se note que se
 * pueden tocar, y la activa se marca en el color de acento con la flecha de su
 * dirección. Se usa como render-prop de `Table.Column` con `allowsSorting`:
 * `<Table.Column allowsSorting id="fecha">{sortableHeader('Fecha')}</Table.Column>`.
 *
 * `activeClassName`: el estilo de la columna activa; por defecto el acento. Las
 * tablas con cabecera de color (la pizarra) pasan otro para que se lea sobre el fondo.
 */
export const sortableHeader = (title: string, activeClassName = 'text-(--accent)') =>
  function SortableHeader({ sortDirection }: { sortDirection?: SortDirection }) {
    const Icon = sortDirection === 'ascending' ? ArrowUp : sortDirection === 'descending' ? ArrowDown : ArrowUpDown;
    return (
      <Table.SortableColumnHeader
        className={`inline-flex cursor-pointer items-center gap-1 whitespace-nowrap ${sortDirection ? activeClassName : ''}`}
        showIndicator={false}
        sortDirection={sortDirection}
      >
        {title}
        <Icon aria-hidden className={`h-3.5 w-3.5 shrink-0 ${sortDirection ? '' : 'opacity-40'}`} />
      </Table.SortableColumnHeader>
    );
  };
