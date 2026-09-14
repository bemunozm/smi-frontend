import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Button, Label, ListBox, Select, Spinner, Table } from '@heroui/react';

import {
  ItemActionsModal,
  type ItemAction,
} from '../components/inventario/ItemActionsModal';
import { EditItemModal } from '../components/inventario/ItemFormModal';
import {
  ALL_BRANCHES,
  CriticalBadge,
  MovementKindChip,
  NUMBER,
  StatusChip,
  movementKind,
  stockStatus,
} from '../components/inventario/shared';
import { useBranches } from '../hooks/useBranches';
import { useCurrentUser } from '../hooks/useCurrentUser';
import { useKardex } from '../hooks/useInventory';
import { DESKTOP_QUERY, useMediaQuery } from '../hooks/useMediaQuery';
import { useUiStore } from '../store/ui';
import { ROLES } from '../types/roles';
import {
  ITEM_TYPE_LABELS,
  MOVEMENT_REASON_LABELS,
  UNIT_LABELS,
  UNIT_SYMBOLS,
  totalQuantity,
  type InventoryItem,
  type ItemStock,
  type StockMovement,
} from '../types/inventory';

const DATE_DAY = new Intl.DateTimeFormat('es-CL', { dateStyle: 'short' });
const DATE_TIME = new Intl.DateTimeFormat('es-CL', { timeStyle: 'short' });

const TODAS = '__todas__';

/**
 * De dónde vino o a dónde fue el asiento. En un traspaso el renglón tiene que
 * explicarse solo: "hacia Faena" y "desde Casa Matriz" son dos asientos
 * distintos y sin la contraparte se leen como un movimiento inexplicable.
 */
function counterparty(movement: StockMovement): string | null {
  if (movement.direction === 'OUT' && movement.destinationBranch) {
    return `hacia ${movement.destinationBranch.name}`;
  }
  if (movement.direction === 'IN' && movement.sourceBranch) {
    return `desde ${movement.sourceBranch.name}`;
  }
  return null;
}

function movementDetail(movement: StockMovement): string {
  return [
    counterparty(movement),
    movement.equipment ? `Equipo ${movement.equipment.internalCode}` : null,
    movement.documentNumber ? `Doc. ${movement.documentNumber}` : null,
    movement.notes,
  ]
    .filter(Boolean)
    .join(' · ');
}

function Card({
  title,
  subtitle,
  action,
  children,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-border bg-card shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3 p-4 sm:p-5">
        <div className="flex flex-col gap-1.5">
          <h2 className="text-base font-bold text-foreground">{title}</h2>
          {subtitle ? (
            <p className="text-sm text-muted-foreground">{subtitle}</p>
          ) : null}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

// --- Existencia por sucursal -----------------------------------------------

function StockByBranch({ item }: { item: InventoryItem }) {
  const isDesktop = useMediaQuery(DESKTOP_QUERY);
  const symbol = UNIT_SYMBOLS[item.unit];
  const total = totalQuantity(item);

  if (item.stocks.length === 0) {
    return (
      <p className="border-t border-border px-4 py-6 text-sm text-muted-foreground sm:px-5">
        Ninguna bodega maneja este ítem todavía.
      </p>
    );
  }

  const rowStatus = (stock: ItemStock) =>
    stockStatus({ ...item, stocks: [stock] }, stock.branchId);

  if (!isDesktop) {
    return (
      <div>
        {item.stocks.map((stock) => (
          <div
            className="flex flex-col gap-2 border-t border-border px-4 py-3"
            key={stock.branchId}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="font-medium text-foreground">
                {stock.branch.name}
              </span>
              <StatusChip {...rowStatus(stock)} />
            </div>
            <div className="flex items-baseline gap-5">
              <div>
                <p className="text-[9.5px] font-bold tracking-[0.06em] text-muted-foreground uppercase">
                  Existencia
                </p>
                <p className="font-mono text-lg font-bold text-foreground">
                  {NUMBER.format(stock.quantity)} {symbol}
                </p>
              </div>
              <div>
                <p className="text-[9.5px] font-bold tracking-[0.06em] text-muted-foreground uppercase">
                  Mínimo
                </p>
                <p className="font-mono text-sm text-muted-foreground">
                  {stock.minimumQuantity > 0
                    ? `${NUMBER.format(stock.minimumQuantity)} ${symbol}`
                    : 'sin fijar'}
                </p>
              </div>
            </div>
          </div>
        ))}
        <div className="flex items-center justify-between gap-2 border-t border-border px-4 py-3">
          <span className="font-bold text-foreground">Total empresa</span>
          <span className="font-mono font-bold text-foreground">
            {NUMBER.format(total)} {symbol}
          </span>
        </div>
      </div>
    );
  }

  return (
    <Table variant="secondary">
      <Table.ScrollContainer>
        <Table.Content aria-label="Existencia por sucursal" className="min-w-160">
          <Table.Header>
            <Table.Column isRowHeader>Sucursal</Table.Column>
            <Table.Column>Existencia</Table.Column>
            <Table.Column>Mínimo</Table.Column>
            <Table.Column>Estado</Table.Column>
          </Table.Header>
          <Table.Body>
            {item.stocks.map((stock) => (
              <Table.Row key={stock.branchId}>
                <Table.Cell className="font-medium text-foreground">
                  {stock.branch.name}
                </Table.Cell>
                <Table.Cell className="font-mono text-sm font-semibold text-foreground">
                  {NUMBER.format(stock.quantity)} {symbol}
                </Table.Cell>
                <Table.Cell className="font-mono text-sm text-muted-foreground">
                  {stock.minimumQuantity > 0
                    ? NUMBER.format(stock.minimumQuantity)
                    : '—'}
                </Table.Cell>
                <Table.Cell>
                  <StatusChip {...rowStatus(stock)} />
                </Table.Cell>
              </Table.Row>
            ))}
            {/* El total va como una fila más y no como un dato aparte: es
                literalmente la suma de las de arriba, no un número propio. */}
            <Table.Row>
              <Table.Cell className="font-bold text-foreground">
                Total empresa
              </Table.Cell>
              <Table.Cell className="font-mono text-sm font-bold text-foreground">
                {NUMBER.format(total)} {symbol}
              </Table.Cell>
              <Table.Cell className="text-sm text-muted-foreground italic">
                Suma de todas las sucursales
              </Table.Cell>
              <Table.Cell> </Table.Cell>
            </Table.Row>
          </Table.Body>
        </Table.Content>
      </Table.ScrollContainer>
    </Table>
  );
}

// --- Historial de movimientos ----------------------------------------------

function MovementHistory({
  item,
  movements,
}: {
  item: InventoryItem;
  movements: StockMovement[];
}) {
  const isDesktop = useMediaQuery(DESKTOP_QUERY);
  const symbol = UNIT_SYMBOLS[item.unit];

  if (movements.length === 0) {
    return (
      <p className="border-t border-border px-4 py-6 text-sm text-muted-foreground sm:px-5">
        Sin movimientos registrados en esta bodega.
      </p>
    );
  }

  if (!isDesktop) {
    return (
      <div>
        {movements.map((movement) => {
          const isIn = movement.direction === 'IN';
          const detail = movementDetail(movement);
          return (
            <div
              className="flex flex-col gap-1 border-t border-border px-4 py-3"
              key={movement.id}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <MovementKindChip kind={movementKind(movement)} />
                  <span className="text-sm text-muted-foreground">
                    {MOVEMENT_REASON_LABELS[movement.reason]}
                  </span>
                </div>
                <span
                  className={`font-mono text-sm font-bold ${
                    isIn ? 'text-[var(--success-soft-foreground)]' : 'text-danger'
                  }`}
                >
                  {isIn ? '+' : '−'}
                  {NUMBER.format(movement.quantity)} {symbol}
                </span>
              </div>
              <div className="flex flex-wrap gap-x-3 text-xs text-muted-foreground">
                <span className="font-mono">
                  {DATE_DAY.format(new Date(movement.occurredAt))}{' '}
                  {DATE_TIME.format(new Date(movement.occurredAt))}
                </span>
                <span>{movement.branch?.name}</span>
                <span>
                  Saldo{' '}
                  <span className="font-mono">
                    {NUMBER.format(movement.resultingBalance)}
                  </span>
                </span>
              </div>
              {detail ? (
                <p className="text-xs text-muted-foreground">{detail}</p>
              ) : null}
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <Table variant="secondary">
      <Table.ScrollContainer>
        <Table.Content aria-label="Historial de movimientos" className="min-w-240">
          <Table.Header>
            <Table.Column isRowHeader>Fecha</Table.Column>
            <Table.Column>Movimiento</Table.Column>
            <Table.Column>Motivo</Table.Column>
            <Table.Column>Sucursal</Table.Column>
            <Table.Column>Cantidad</Table.Column>
            <Table.Column>Saldo</Table.Column>
            <Table.Column>Detalle</Table.Column>
          </Table.Header>
          <Table.Body>
            {movements.map((movement) => {
              const isIn = movement.direction === 'IN';
              return (
                <Table.Row key={movement.id}>
                  <Table.Cell>
                    <div className="flex flex-col">
                      <span className="text-sm font-medium text-foreground">
                        {DATE_DAY.format(new Date(movement.occurredAt))}
                      </span>
                      <span className="font-mono text-xs text-muted-foreground">
                        {DATE_TIME.format(new Date(movement.occurredAt))}
                      </span>
                    </div>
                  </Table.Cell>
                  <Table.Cell>
                    <MovementKindChip kind={movementKind(movement)} />
                  </Table.Cell>
                  <Table.Cell className="text-sm text-foreground">
                    {MOVEMENT_REASON_LABELS[movement.reason]}
                  </Table.Cell>
                  <Table.Cell className="text-sm text-muted-foreground">
                    {movement.branch?.name ?? '—'}
                  </Table.Cell>
                  <Table.Cell
                    className={`font-mono text-sm font-semibold ${
                      isIn ? 'text-[var(--success-soft-foreground)]' : 'text-danger'
                    }`}
                  >
                    {isIn ? '+' : '−'}
                    {NUMBER.format(movement.quantity)} {symbol}
                  </Table.Cell>
                  <Table.Cell className="font-mono text-sm text-muted-foreground">
                    {NUMBER.format(movement.resultingBalance)}
                  </Table.Cell>
                  <Table.Cell className="max-w-65 truncate text-sm text-muted-foreground">
                    {movementDetail(movement)}
                  </Table.Cell>
                </Table.Row>
              );
            })}
          </Table.Body>
        </Table.Content>
      </Table.ScrollContainer>
    </Table>
  );
}

// --- Vista -----------------------------------------------------------------

/**
 * Ficha del ítem: qué es, cuánto hay en cada bodega y todo lo que le pasó.
 *
 * Reemplaza a la pantalla que era solo el kardex. El movimiento aislado no dice
 * nada sin la existencia al lado — "salieron 5" se entiende distinto si quedan
 * 40 o si quedan 2 — y quien abre el historial de un ítem viene, casi siempre,
 * a decidir si repone.
 */
export function FichaItemView() {
  const { id = '' } = useParams<{ id: string }>();
  const { user } = useCurrentUser();
  const isAdmin = user?.role === ROLES.ADMIN;
  const canWrite = isAdmin || user?.role === ROLES.MANTENEDOR;

  const selectedBranchId = useUiStore((state) => state.selectedBranchId);
  const [branchFilter, setBranchFilter] = useState<string>(TODAS);
  const [action, setAction] = useState<ItemAction | null>(null);
  const [isEditing, setIsEditing] = useState(false);

  const { data: branches } = useBranches({ isActive: true });
  const { data, isPending, isError, error } = useKardex(
    id,
    branchFilter === TODAS ? undefined : branchFilter,
  );

  if (isPending) {
    return (
      <div className="flex justify-center py-16">
        <Spinner color="accent" size="lg" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="flex flex-col gap-4">
        <Link className="text-sm text-(--accent) hover:underline" to="/inventario">
          ← Volver a Inventario
        </Link>
        <div className="rounded-lg bg-danger-soft px-4 py-3 text-sm text-danger-soft-foreground">
          {error instanceof Error
            ? error.message
            : 'No se pudo obtener la ficha del ítem.'}
        </div>
      </div>
    );
  }

  const { item, movements } = data;
  const status = stockStatus(item, ALL_BRANCHES);

  return (
    <div className="flex max-w-280 flex-col gap-5">
      <Link className="text-sm text-(--accent) hover:underline" to="/inventario">
        ← Volver a Inventario
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-display text-[26px] font-semibold tracking-[-0.02em] text-foreground">
              {item.name}
            </h1>
            <span className="inline-flex shrink-0 items-center rounded-full bg-[var(--surface-tertiary)] px-2 py-0.5 font-mono text-xs font-semibold text-foreground">
              {item.sku}
            </span>
            <span className="inline-flex shrink-0 items-center rounded-full bg-[var(--surface-tertiary)] px-2 py-0.5 text-xs font-semibold text-muted-foreground">
              {ITEM_TYPE_LABELS[item.type]}
            </span>
            {item.isCritical ? <CriticalBadge /> : null}
            <StatusChip {...status} />
          </div>
          <p className="text-sm text-muted-foreground">
            {item.partNumber ? (
              <span className="font-semibold">N° parte {item.partNumber} · </span>
            ) : null}
            {item.category?.name ?? 'Sin categoría'} ·{' '}
            {UNIT_LABELS[item.unit]}
            {item.defaultSupplier ? ` · ${item.defaultSupplier}` : ''}
          </p>
          {item.description ? (
            <p className="max-w-160 text-sm text-muted-foreground">
              {item.description}
            </p>
          ) : null}
        </div>

        <div className="flex flex-wrap gap-2">
          {isAdmin ? (
            <Button onPress={() => setIsEditing(true)} variant="secondary">
              Editar ítem
            </Button>
          ) : null}
          {canWrite ? (
            <Button onPress={() => setAction('movement')}>
              Registrar movimiento
            </Button>
          ) : null}
        </div>
      </div>

      <Card
        subtitle="No existe un stock global: el total es la suma de lo que hay en cada sucursal."
        title="Existencia por sucursal"
      >
        <StockByBranch item={item} />
      </Card>

      <Card
        action={
          <Select
            className="w-full sm:w-52"
            onChange={(value) => {
              if (value) setBranchFilter(String(value));
            }}
            value={branchFilter}
          >
            <Label>Bodega</Label>
            <Select.Trigger>
              <Select.Value />
              <Select.Indicator />
            </Select.Trigger>
            <Select.Popover>
              <ListBox>
                <ListBox.Item id={TODAS} textValue="Todas las bodegas">
                  Todas las bodegas
                  <ListBox.ItemIndicator />
                </ListBox.Item>
                {(branches ?? []).map((branch) => (
                  <ListBox.Item
                    id={branch.id}
                    key={branch.id}
                    textValue={branch.name}
                  >
                    {branch.name}
                    <ListBox.ItemIndicator />
                  </ListBox.Item>
                ))}
              </ListBox>
            </Select.Popover>
          </Select>
        }
        subtitle="Entradas, salidas, traspasos y ajustes, de lo más reciente a lo más antiguo. Cada renglón deja el saldo de SU bodega."
        title="Historial de movimientos"
      >
        <MovementHistory item={item} movements={movements} />
      </Card>

      {action ? (
        <ItemActionsModal
          branchId={selectedBranchId ?? ALL_BRANCHES}
          branches={branches ?? []}
          canWrite={canWrite}
          initialView={action}
          isAdmin={isAdmin}
          isOpen
          item={item}
          onEdit={() => {
            setAction(null);
            setIsEditing(true);
          }}
          onOpenChange={(open) => !open && setAction(null)}
        />
      ) : null}

      {isEditing ? (
        <EditItemModal
          branches={branches ?? []}
          isOpen
          item={item}
          onOpenChange={setIsEditing}
        />
      ) : null}
    </div>
  );
}
