import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Chip, Label, ListBox, Select, Spinner, Table } from '@heroui/react';

import { useBranches } from '../hooks/useBranches';
import { useKardex } from '../hooks/useInventory';
import { useUiStore } from '../store/ui';
import {
  ITEM_TYPE_LABELS,
  MOVEMENT_REASON_LABELS,
  UNIT_SYMBOLS,
  type StockMovement,
} from '../types/inventory';

const NUMBER = new Intl.NumberFormat('es-CL', { maximumFractionDigits: 2 });
const DATE = new Intl.DateTimeFormat('es-CL', {
  dateStyle: 'short',
  timeStyle: 'short',
});

const TODAS = '__todas__';

/**
 * De dónde vino o a dónde fue el asiento. En un traspaso el renglón tiene que
 * explicarse solo: "salida hacia Faena" y "entrada desde Casa Matriz" son dos
 * asientos distintos y sin la contraparte se leen como un movimiento
 * inexplicable.
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

export function ItemKardexView() {
  const { id = '' } = useParams<{ id: string }>();
  const selectedBranchId = useUiStore((state) => state.selectedBranchId);
  const [branchFilter, setBranchFilter] = useState<string>(
    selectedBranchId ?? TODAS,
  );

  const { data: branches } = useBranches({ isActive: true });
  const { data, isPending, isError, error } = useKardex(
    id,
    branchFilter === TODAS ? undefined : branchFilter,
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Link
          className="text-sm text-(--accent) hover:underline"
          to="/inventario"
        >
          ← Volver a Inventario
        </Link>
        <span className="text-[11px] font-medium tracking-[0.14em] text-(--eyebrow-color) uppercase">
          SMI · Inventario
        </span>
        <h1 className="font-display text-[28px] font-semibold tracking-[-0.03em] text-foreground">
          {data ? `${data.item.sku} · ${data.item.name}` : 'Kardex'}
        </h1>
        {data ? (
          <p className="text-sm text-muted-foreground">
            {ITEM_TYPE_LABELS[data.item.type]} · cada renglón lleva el saldo de
            SU bodega después del movimiento.
          </p>
        ) : null}
      </div>

      {data ? (
        <div className="flex flex-wrap items-center gap-2">
          {data.item.stocks.map((stock) => (
            <Chip
              key={stock.branchId}
              color={
                stock.minimumQuantity > 0 &&
                stock.quantity <= stock.minimumQuantity
                  ? 'warning'
                  : 'default'
              }
              size="sm"
              variant="soft"
            >
              {stock.branch.name}: {NUMBER.format(stock.quantity)}{' '}
              {UNIT_SYMBOLS[data.item.unit]}
            </Chip>
          ))}
        </div>
      ) : null}

      <Select
        className="w-full sm:w-56"
        value={branchFilter}
        onChange={(value) => {
          if (value) setBranchFilter(String(value));
        }}
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
                key={branch.id}
                id={branch.id}
                textValue={branch.name}
              >
                {branch.name}
                <ListBox.ItemIndicator />
              </ListBox.Item>
            ))}
          </ListBox>
        </Select.Popover>
      </Select>

      {isPending ? (
        <div className="flex justify-center py-16">
          <Spinner color="accent" size="lg" />
        </div>
      ) : null}

      {isError ? (
        <div className="rounded-lg bg-danger-soft px-4 py-3 text-sm text-danger-soft-foreground">
          {error instanceof Error
            ? error.message
            : 'No se pudo obtener el kardex.'}
        </div>
      ) : null}

      {data && data.movements.length === 0 ? (
        <div className="flex flex-col items-center gap-1 rounded-lg border border-dashed border-border py-16 text-center">
          <p className="text-sm font-medium text-foreground">
            Sin movimientos registrados
          </p>
        </div>
      ) : null}

      {data && data.movements.length > 0 ? (
        <Table variant="secondary">
          <Table.ScrollContainer>
            <Table.Content aria-label="Kardex" className="min-w-200">
              <Table.Header>
                <Table.Column isRowHeader>Fecha</Table.Column>
                <Table.Column>Bodega</Table.Column>
                <Table.Column>Motivo</Table.Column>
                <Table.Column>Cantidad</Table.Column>
                <Table.Column>Saldo en bodega</Table.Column>
                <Table.Column>Detalle</Table.Column>
              </Table.Header>
              <Table.Body>
                {data.movements.map((movement) => {
                  const sign = movement.direction === 'IN' ? '+' : '−';
                  const counter = counterparty(movement);
                  return (
                    <Table.Row key={movement.id}>
                      <Table.Cell className="font-mono text-xs text-muted-foreground">
                        {DATE.format(new Date(movement.occurredAt))}
                      </Table.Cell>
                      <Table.Cell className="text-sm">
                        {movement.branch?.name ?? '—'}
                      </Table.Cell>
                      <Table.Cell>
                        <Chip
                          color={
                            movement.direction === 'IN' ? 'success' : 'warning'
                          }
                          size="sm"
                          variant="soft"
                        >
                          {MOVEMENT_REASON_LABELS[movement.reason]}
                        </Chip>
                      </Table.Cell>
                      <Table.Cell className="font-mono text-sm">
                        {sign}
                        {NUMBER.format(movement.quantity)}{' '}
                        {UNIT_SYMBOLS[data.item.unit]}
                      </Table.Cell>
                      <Table.Cell className="font-mono text-sm">
                        {NUMBER.format(movement.resultingBalance)}
                      </Table.Cell>
                      <Table.Cell className="text-sm text-muted-foreground">
                        {counter ? <span>{counter}. </span> : null}
                        {movement.equipment
                          ? `Equipo ${movement.equipment.internalCode}. `
                          : ''}
                        {movement.notes ?? ''}
                      </Table.Cell>
                    </Table.Row>
                  );
                })}
              </Table.Body>
            </Table.Content>
          </Table.ScrollContainer>
        </Table>
      ) : null}
    </div>
  );
}
