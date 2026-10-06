import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Spinner } from '@heroui/react';
import { ArrowDownLeft, ArrowUpRight, Info } from 'lucide-react';

import {
  Chip,
  TD,
  TH,
  Tabla,
  Tarjeta,
  type Tono,
} from '../components/terreno/ui';
import { NUMBER, movementKind, type MovementKind } from '../components/inventario/shared';
import { useItems, useMovements } from '../hooks/useInventory';
import { useMediaQuery, DESKTOP_QUERY } from '../hooks/useMediaQuery';
import {
  UNIT_SYMBOLS,
  totalQuantity,
  type InventoryItem,
  type StockMovement,
} from '../types/inventory';

const DATE = new Intl.DateTimeFormat('es-CL', {
  day: '2-digit',
  month: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
});

/** Motivos de salida que nacen del trabajo del taller. */
const WORKSHOP_REASONS = new Set(['INTERVENTION', 'ACTIVITY', 'EXTRAORDINARY_WORK']);

/** La clase de movimiento, con el chip del kit de Terreno. */
const KIND_TONO: Record<MovementKind, { label: string; tono: Tono }> = {
  entrada: { label: 'Entrada', tono: 'success' },
  salida: { label: 'Salida', tono: 'danger' },
  traspaso: { label: 'Traspaso', tono: 'info' },
  ajuste: { label: 'Ajuste', tono: 'neutral' },
};

function KindChip({ movement }: { movement: StockMovement }) {
  const { label, tono } = KIND_TONO[movementKind(movement)];
  return <Chip tono={tono}>{label}</Chip>;
}

interface ItemStatus {
  tono: 'success' | 'warning' | 'danger';
  label: string;
}

function itemStatus(item: InventoryItem): ItemStatus {
  const total = totalQuantity(item);
  if (total <= 0) return { tono: 'danger', label: 'Reponer' };
  const belowMinimum = item.stocks.some(
    (stock) => stock.minimumQuantity > 0 && stock.quantity <= stock.minimumQuantity,
  );
  return belowMinimum ? { tono: 'warning', label: 'Stock bajo' } : { tono: 'success', label: 'OK' };
}

const METER_BAR: Record<ItemStatus['tono'], string> = {
  success: 'bg-[var(--success)]',
  warning: 'bg-[var(--warning)]',
  danger: 'bg-[var(--danger)]',
};

/** Tarjeta de existencia de un insumo afectado por el taller — kit de Terreno. */
function ItemStockCard({ item }: { item: InventoryItem }) {
  const status = itemStatus(item);
  const total = totalQuantity(item);
  const minimumTotal = item.stocks.reduce((sum, stock) => sum + stock.minimumQuantity, 0);
  const meterPct =
    minimumTotal > 0
      ? Math.min(100, Math.max(4, (total / (minimumTotal * 2.5)) * 100))
      : total > 0
        ? 70
        : 4;

  return (
    <Tarjeta className="gap-1">
      <div className="flex items-center justify-between gap-2">
        <span className="tabular text-xs text-muted-foreground">{item.sku}</span>
        <Chip tono={status.tono}>{status.label}</Chip>
      </div>
      <span className="text-sm font-semibold">{item.name}</span>
      <div className="tabular text-[26px] leading-tight font-bold tracking-[-0.02em]">
        {NUMBER.format(total)}{' '}
        <span className="text-sm font-medium text-muted-foreground">{UNIT_SYMBOLS[item.unit]}</span>
      </div>
      {minimumTotal > 0 ? (
        <span className="text-[13px] text-muted-foreground">mín. {NUMBER.format(minimumTotal)}</span>
      ) : null}
      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-[#eef0f2]">
        <span
          className={`block h-full rounded-full ${METER_BAR[status.tono]}`}
          style={{ width: `${meterPct}%` }}
        />
      </div>
    </Tarjeta>
  );
}

function QuantityMark({ movement }: { movement: StockMovement }) {
  const isIn = movement.direction === 'IN';
  return (
    <span
      className={`tabular inline-flex items-center gap-1 text-sm font-semibold ${
        isIn ? 'text-[var(--success-soft-foreground)]' : 'text-[var(--danger)]'
      }`}
    >
      {isIn ? <ArrowDownLeft size={14} /> : <ArrowUpRight size={14} />}
      {isIn ? '+' : '−'}
      {NUMBER.format(movement.quantity)} {movement.item ? UNIT_SYMBOLS[movement.item.unit] : ''}
    </span>
  );
}

/** Versión tarjeta de un movimiento — móvil, mismo contenido que la fila. */
function MovementRowCard({ movement }: { movement: StockMovement }) {
  return (
    <Tarjeta className="gap-1.5">
      <div className="flex items-start justify-between gap-2">
        <span className="tabular text-[15px] font-semibold">
          {movement.item?.sku ?? movement.itemId}
        </span>
        <QuantityMark movement={movement} />
      </div>
      <span className="text-sm text-muted-foreground">{movement.item?.name}</span>
      <div className="flex flex-wrap items-center gap-2">
        <KindChip movement={movement} />
        {movement.equipment ? (
          <span className="tabular text-xs text-muted-foreground">
            {movement.equipment.internalCode}
          </span>
        ) : null}
      </div>
      <div className="flex flex-wrap items-center gap-x-3 text-xs text-muted-foreground">
        <span>{DATE.format(new Date(movement.occurredAt))}</span>
        <span>
          Saldo: <span className="tabular">{NUMBER.format(movement.resultingBalance)}</span>
        </span>
      </div>
    </Tarjeta>
  );
}

/**
 * Sub-vista "Stock" del taller — kit de Terreno. Existencias de los insumos
 * que el taller consumió hace poco y el historial reciente de movimientos,
 * con datos 100% reales de `/api/inventory/*`.
 */
export function WorkshopStockView() {
  const isDesktop = useMediaQuery(DESKTOP_QUERY);
  const { data: movements, isPending, isError, error } = useMovements({ limit: 20 });
  const { data: items } = useItems();

  const highlightedItems = useMemo(() => {
    const byId = new Map((items ?? []).map((item) => [item.id, item]));
    const fromWorkshop: InventoryItem[] = [];
    for (const movement of movements ?? []) {
      if (movement.direction !== 'OUT' || !WORKSHOP_REASONS.has(movement.reason)) continue;
      const item = byId.get(movement.itemId);
      if (item && !fromWorkshop.some((candidate) => candidate.id === item.id)) {
        fromWorkshop.push(item);
      }
      if (fromWorkshop.length === 3) break;
    }
    if (fromWorkshop.length > 0) return fromWorkshop;
    return (items ?? []).filter((item) => itemStatus(item).tono !== 'success').slice(0, 3);
  }, [items, movements]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 className="font-display text-xl font-semibold tracking-[-0.02em] text-foreground">
          Descuento de stock
        </h2>
        <p className="text-sm text-muted-foreground">
          Cada insumo o repuesto usado en una operación queda como movimiento trazable en
          Inventario.
        </p>
      </div>

      <div className="flex items-start gap-2.5 rounded-2xl bg-[var(--accent-soft)] px-3.5 py-3 text-[13px] leading-5 text-[var(--accent-soft-foreground)]">
        <Info className="mt-0.5 h-4 w-4 shrink-0" />
        <span>
          Cada insumo usado al <strong>finalizar una tarea</strong> se descuenta automáticamente de
          la bodega elegida y queda como salida trazable en{' '}
          <Link className="font-semibold underline" to="/inventario/movimientos">
            Inventario
          </Link>
          , ligada a su OT.
        </span>
      </div>

      {highlightedItems.length > 0 ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3">
          {highlightedItems.map((item) => (
            <ItemStockCard key={item.id} item={item} />
          ))}
        </div>
      ) : null}

      {isError ? (
        <div
          className="rounded-2xl bg-[var(--danger-soft)] px-4 py-3 text-sm text-[var(--danger-soft-foreground)]"
          role="alert"
        >
          {error instanceof Error ? error.message : 'No se pudo obtener el historial.'}
        </div>
      ) : null}

      {isPending ? (
        <div className="flex justify-center py-16">
          <Spinner color="accent" size="lg" />
        </div>
      ) : (movements ?? []).length === 0 ? (
        !isError ? (
          <div className="flex flex-col items-center gap-1 rounded-2xl border border-dashed border-border py-16 text-center">
            <p className="text-sm font-semibold">Sin movimientos de inventario</p>
            <p className="text-sm text-muted-foreground">
              Cuando el taller consuma insumos, las salidas aparecen acá.
            </p>
          </div>
        ) : null
      ) : !isDesktop ? (
        <div className="flex flex-col gap-2.5">
          {(movements ?? []).map((movement) => (
            <MovementRowCard key={movement.id} movement={movement} />
          ))}
        </div>
      ) : (
        <Tabla
          detalle={`Últimos ${(movements ?? []).length} asientos`}
          titulo="Movimientos de inventario"
        >
          <thead>
            <tr>
              <th className={TH}>Fecha</th>
              <th className={TH}>Insumo</th>
              <th className={TH}>Cantidad</th>
              <th className={TH}>Equipo</th>
              <th className={`${TH} text-right`}>Saldo</th>
              <th className={TH}>Motivo</th>
            </tr>
          </thead>
          <tbody>
            {(movements ?? []).map((movement) => (
              <tr key={movement.id}>
                <td className={`${TD} tabular whitespace-nowrap text-muted-foreground`}>
                  {DATE.format(new Date(movement.occurredAt))}
                </td>
                <td className={TD}>
                  <div className="flex flex-col">
                    <Link
                      className="tabular text-sm font-semibold text-[var(--accent)] hover:underline"
                      to={`/inventario/${movement.itemId}`}
                    >
                      {movement.item?.sku ?? movement.itemId}
                    </Link>
                    <span className="text-xs text-muted-foreground">{movement.item?.name}</span>
                  </div>
                </td>
                <td className={TD}>
                  <QuantityMark movement={movement} />
                </td>
                <td className={`${TD} tabular text-muted-foreground`}>
                  {movement.equipment?.internalCode ?? '—'}
                </td>
                <td className={`${TD} tabular text-right`}>
                  {NUMBER.format(movement.resultingBalance)}
                </td>
                <td className={TD}>
                  <KindChip movement={movement} />
                </td>
              </tr>
            ))}
          </tbody>
        </Tabla>
      )}

      <p className="text-xs text-muted-foreground">
        Cada salida queda ligada a su equipo y motivo — trazabilidad entre Taller e Inventario.
      </p>
    </div>
  );
}
