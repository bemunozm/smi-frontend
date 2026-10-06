import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Chip, Spinner, Table } from '@heroui/react';
import { ArrowDownLeft, ArrowUpRight, Info } from 'lucide-react';

import { useItems, useMovements } from '../hooks/useInventory';
import { useMediaQuery, DESKTOP_QUERY } from '../hooks/useMediaQuery';
import { MovementKindChip, NUMBER, movementKind } from '../components/inventario/shared';
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

interface ItemStatus {
  color: 'success' | 'warning' | 'danger';
  label: string;
}

function itemStatus(item: InventoryItem): ItemStatus {
  const total = totalQuantity(item);
  if (total <= 0) return { color: 'danger', label: 'Reponer' };
  const belowMinimum = item.stocks.some(
    (stock) => stock.minimumQuantity > 0 && stock.quantity <= stock.minimumQuantity,
  );
  return belowMinimum ? { color: 'warning', label: 'Stock bajo' } : { color: 'success', label: 'OK' };
}

const METER_BAR: Record<ItemStatus['color'], string> = {
  success: 'bg-success',
  warning: 'bg-warning',
  danger: 'bg-danger',
};

/**
 * Tarjeta de existencia de un insumo afectado por el taller: saldo total
 * real, alerta contra el mínimo de bodega y un medidor proporcional.
 */
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
    <div className="flex flex-col rounded-xl border border-border bg-card p-4 shadow-sm">
      <div className="mb-2.5 flex items-center justify-between gap-2">
        <span className="font-mono text-xs text-muted-foreground">{item.sku}</span>
        <Chip color={status.color} size="sm" variant="soft">
          {status.label}
        </Chip>
      </div>
      <span className="text-sm font-semibold">{item.name}</span>
      <div className="mt-1 font-display text-[26px] font-semibold tracking-[-0.02em]">
        {NUMBER.format(total)}{' '}
        <span className="text-sm font-medium text-muted-foreground">{UNIT_SYMBOLS[item.unit]}</span>
      </div>
      {minimumTotal > 0 ? (
        <span className="mt-0.5 text-[13px] text-muted-foreground">mín. {NUMBER.format(minimumTotal)}</span>
      ) : null}
      <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-muted">
        <span
          className={`block h-full rounded-full ${METER_BAR[status.color]}`}
          style={{ width: `${meterPct}%` }}
        />
      </div>
    </div>
  );
}

function QuantityMark({ movement }: { movement: StockMovement }) {
  const isIn = movement.direction === 'IN';
  return (
    <span
      className={`inline-flex items-center gap-1 font-mono text-sm font-semibold ${
        isIn ? 'text-[var(--success-soft-foreground)]' : 'text-danger'
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
    <div className="flex flex-col gap-1.5 rounded-xl border border-border bg-card p-3.5 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <span className="font-mono text-[15px] font-semibold">{movement.item?.sku ?? movement.itemId}</span>
        <QuantityMark movement={movement} />
      </div>
      <span className="text-sm text-muted-foreground">{movement.item?.name}</span>
      <div className="flex flex-wrap items-center gap-2">
        <MovementKindChip kind={movementKind(movement)} />
        {movement.equipment ? (
          <span className="font-mono text-xs text-muted-foreground">{movement.equipment.internalCode}</span>
        ) : null}
      </div>
      <div className="flex flex-wrap items-center gap-x-3 text-xs text-muted-foreground">
        <span>{DATE.format(new Date(movement.occurredAt))}</span>
        <span>
          Saldo: <span className="font-mono">{NUMBER.format(movement.resultingBalance)}</span>
        </span>
      </div>
    </div>
  );
}

/**
 * Sub-vista "Stock" del taller (diseño Mantenedor Taller): las existencias de
 * los insumos que el taller consumió hace poco y el historial reciente de
 * movimientos de Inventario, sin salir del módulo. Los datos son 100% reales
 * (`/api/inventory/*`); el descuento AUTOMÁTICO al finalizar una tarea
 * todavía no existe (seam pendiente en el backend de Mantenimiento), y el
 * banner lo dice en vez de simularlo.
 */
export function WorkshopStockView() {
  const isDesktop = useMediaQuery(DESKTOP_QUERY);
  const { data: movements, isPending, isError, error } = useMovements({ limit: 20 });
  const { data: items } = useItems();

  /**
   * Insumos a destacar: los de las salidas más recientes originadas en el
   * taller; si no hay ninguna, los que están bajo su mínimo. Máximo 3.
   */
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
    return (items ?? []).filter((item) => itemStatus(item).color !== 'success').slice(0, 3);
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

      <div className="flex items-start gap-2.5 rounded-lg bg-accent px-3.5 py-3 text-[13px] leading-5 text-accent-foreground">
        <Info className="mt-0.5 size-4 shrink-0" />
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
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {highlightedItems.map((item) => (
            <ItemStockCard key={item.id} item={item} />
          ))}
        </div>
      ) : null}

      {isError ? (
        <div className="rounded-lg bg-danger-soft px-4 py-3 text-sm text-danger-soft-foreground" role="alert">
          {error instanceof Error ? error.message : 'No se pudo obtener el historial.'}
        </div>
      ) : null}

      {isPending ? (
        <div className="flex justify-center py-16">
          <Spinner color="accent" size="lg" />
        </div>
      ) : (movements ?? []).length === 0 ? (
        !isError ? (
          <div className="flex flex-col items-center gap-1 rounded-lg border border-dashed border-border py-16 text-center">
            <p className="text-sm font-medium text-foreground">Sin movimientos de inventario</p>
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
        <Table variant="secondary">
          <Table.ScrollContainer>
            <Table.Content aria-label="Movimientos de inventario" className="min-w-200">
              <Table.Header>
                <Table.Column isRowHeader>Fecha</Table.Column>
                <Table.Column>Insumo</Table.Column>
                <Table.Column>Cantidad</Table.Column>
                <Table.Column>Equipo</Table.Column>
                <Table.Column>Saldo</Table.Column>
                <Table.Column>Motivo</Table.Column>
              </Table.Header>
              <Table.Body>
                {(movements ?? []).map((movement) => (
                  <Table.Row key={movement.id}>
                    <Table.Cell className="font-mono text-sm whitespace-nowrap text-muted-foreground">
                      {DATE.format(new Date(movement.occurredAt))}
                    </Table.Cell>
                    <Table.Cell>
                      <div className="flex flex-col">
                        <Link
                          className="font-mono text-sm font-medium text-(--accent) hover:underline"
                          to={`/inventario/${movement.itemId}`}
                        >
                          {movement.item?.sku ?? movement.itemId}
                        </Link>
                        <span className="text-xs text-muted-foreground">{movement.item?.name}</span>
                      </div>
                    </Table.Cell>
                    <Table.Cell>
                      <QuantityMark movement={movement} />
                    </Table.Cell>
                    <Table.Cell className="font-mono text-sm text-muted-foreground">
                      {movement.equipment?.internalCode ?? '—'}
                    </Table.Cell>
                    <Table.Cell className="font-mono text-sm">
                      {NUMBER.format(movement.resultingBalance)}
                    </Table.Cell>
                    <Table.Cell>
                      <MovementKindChip kind={movementKind(movement)} />
                    </Table.Cell>
                  </Table.Row>
                ))}
              </Table.Body>
            </Table.Content>
          </Table.ScrollContainer>
        </Table>
      )}

      <p className="text-xs text-muted-foreground">
        Cada salida queda ligada a su equipo y motivo — trazabilidad entre Taller e Inventario.
      </p>
    </div>
  );
}
