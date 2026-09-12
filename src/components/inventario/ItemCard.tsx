import { ChevronRight } from 'lucide-react';

import {
  UNIT_SYMBOLS,
  isBelowMinimumAt,
  quantityAt,
  stockAt,
  type InventoryItem,
} from '../../types/inventory';
import { CriticalBadge, NUMBER, StatusChip, stockStatus } from './shared';

/**
 * El ítem en teléfono y tablet. **Toda la tarjeta es tocable** y abre el panel
 * de acciones: en una pantalla de 390 px no cabe una columna de acciones, y
 * repartir seis botones chicos por tarjeta es justo lo que no se puede apretar
 * con guantes.
 *
 * La cifra de existencia va grande y la unidad al lado, porque es el dato que
 * se viene a buscar; el mínimo la acompaña en chico para que "8" y "8 de un
 * mínimo de 10" no se lean igual.
 */
export function ItemCard({
  item,
  branchId,
  onOpen,
}: {
  item: InventoryItem;
  branchId: string;
  onOpen: () => void;
}) {
  const symbol = UNIT_SYMBOLS[item.unit];
  const here = quantityAt(item, branchId);
  const minimum = stockAt(item, branchId)?.minimumQuantity ?? 0;
  const status = stockStatus(item, branchId);
  const belowMinimum = isBelowMinimumAt(item, branchId);

  return (
    <button
      // Sin etiqueta propia, el nombre accesible de la tarjeta es la ristra de
      // todo lo que lleva dentro ("FIL-001 OK Filtro de aceite…"). Lo que hace
      // el botón es abrir las acciones del ítem, y eso es lo que debe anunciar.
      aria-label={`Acciones de ${item.sku}`}
      className="w-full cursor-pointer rounded-xl border border-border bg-card p-3.5 text-left shadow-sm transition-colors hover:bg-[var(--surface-secondary)]"
      onClick={onOpen}
      type="button"
    >
      <div className="flex items-center justify-between gap-2.5">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <span className="font-mono text-[17px] font-semibold text-foreground">
            {item.sku}
          </span>
          <StatusChip label={status.label} tone={status.tone} />
          {item.isCritical ? <CriticalBadge /> : null}
        </div>
        <ChevronRight className="shrink-0 text-muted-foreground" size={20} />
      </div>

      <div className="mt-1.5 text-sm text-muted-foreground">
        {item.name}
        {item.category ? ` · ${item.category.name}` : ''}
        {item.partNumber ? ` · N° parte ${item.partNumber}` : ''}
      </div>

      <div className="mt-3 flex items-baseline gap-2">
        <span
          className={`font-mono text-[28px] leading-none font-bold ${
            belowMinimum ? 'text-danger' : 'text-foreground'
          }`}
        >
          {NUMBER.format(here)}
        </span>
        <span className="font-mono text-sm font-semibold text-muted-foreground">
          {symbol}
        </span>
        <span className="text-xs text-muted-foreground">
          {minimum > 0 ? (
            <>
              / mín <span className="font-mono">{NUMBER.format(minimum)}</span>
            </>
          ) : (
            'sin mínimo fijado'
          )}
        </span>
      </div>
    </button>
  );
}
