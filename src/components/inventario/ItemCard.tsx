import { ChevronRight } from 'lucide-react';

import {
  UNIT_SYMBOLS,
  quantityAt,
  stockAt,
  totalQuantity,
  type InventoryItem,
} from '../../types/inventory';
import {
  ALL_BRANCHES,
  BranchBreakdown,
  CriticalBadge,
  NUMBER,
  StatusChip,
  stockStatus,
} from './shared';

/**
 * El ítem en teléfono y tablet. **Toda la tarjeta es tocable** y abre el panel
 * de acciones: en una pantalla de 390 px no cabe una columna de acciones, y
 * repartir cuatro botones chicos por tarjeta es justo lo que no se puede
 * apretar con guantes.
 *
 * La cifra va grande y la unidad al lado, porque es el dato que se viene a
 * buscar; debajo, en chico, en qué sucursal está — que con dos faenas es la
 * diferencia entre usarlo hoy y pedir un traslado.
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
  const isAll = branchId === ALL_BRANCHES;
  const symbol = UNIT_SYMBOLS[item.unit];
  const quantity = isAll ? totalQuantity(item) : quantityAt(item, branchId);
  const minimum = isAll ? 0 : (stockAt(item, branchId)?.minimumQuantity ?? 0);
  const status = stockStatus(item, branchId);

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
            status.tone === 'peligro' ? 'text-danger' : 'text-foreground'
          }`}
        >
          {NUMBER.format(quantity)}
        </span>
        <span className="font-mono text-sm font-semibold text-muted-foreground">
          {symbol}
        </span>
        <span className="text-xs text-muted-foreground">
          {isAll ? (
            'en total'
          ) : minimum > 0 ? (
            <>
              / mín <span className="font-mono">{NUMBER.format(minimum)}</span>
            </>
          ) : (
            'sin mínimo fijado'
          )}
        </span>
      </div>

      <div className="mt-2">
        <BranchBreakdown
          highlightBranchId={isAll ? undefined : branchId}
          item={item}
        />
      </div>
    </button>
  );
}
