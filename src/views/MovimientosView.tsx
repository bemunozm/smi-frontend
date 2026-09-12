import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Input,
  Label,
  ListBox,
  Select,
  Spinner,
  Table,
  TextField,
} from '@heroui/react';
import { ArrowDownLeft, ArrowUpRight } from 'lucide-react';

import { ALL_BRANCHES, NUMBER, Segmented } from '../components/inventario/shared';
import { useBranches } from '../hooks/useBranches';
import { useMovements } from '../hooks/useInventory';
import { DESKTOP_QUERY, useMediaQuery } from '../hooks/useMediaQuery';
import type { Branch } from '../types/branch';
import {
  MOVEMENT_REASON_LABELS,
  UNIT_SYMBOLS,
  type StockMovement,
} from '../types/inventory';

const ALL_KINDS = 'todos';

/**
 * Qué pasó con el inventario. Agrupa por lo que la gente pregunta — "qué
 * entró", "qué se usó", "qué se movió entre faenas" — y no por la dirección
 * del asiento, que es un detalle del modelo: un traspaso son dos asientos, uno
 * de entrada y otro de salida, y listarlo bajo "salidas" lo haría parecer
 * material consumido.
 */
type Kind = typeof ALL_KINDS | 'entradas' | 'salidas' | 'traspasos' | 'ajustes';

const KIND_FILTERS: Record<
  Kind,
  { direction?: 'IN' | 'OUT'; reason?: string }
> = {
  todos: {},
  entradas: { direction: 'IN' },
  salidas: { direction: 'OUT' },
  traspasos: { reason: 'TRANSFER' },
  ajustes: { reason: 'PHYSICAL_ADJUSTMENT' },
};

const DATE = new Intl.DateTimeFormat('es-CL', {
  day: '2-digit',
  month: '2-digit',
  year: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
});

/** El renglón del historial, en palabras: de dónde salió y a dónde entró. */
function movementLabel(movement: StockMovement): string {
  if (movement.reason === 'TRANSFER') {
    const counterpart =
      movement.direction === 'OUT'
        ? movement.destinationBranch?.name
        : movement.sourceBranch?.name;
    return movement.direction === 'OUT'
      ? `Traspaso hacia ${counterpart ?? 'otra sucursal'}`
      : `Traspaso desde ${counterpart ?? 'otra sucursal'}`;
  }
  return MOVEMENT_REASON_LABELS[movement.reason];
}

function DirectionMark({ movement }: { movement: StockMovement }) {
  const isIn = movement.direction === 'IN';
  return (
    <span
      className={`inline-flex items-center gap-1 font-mono text-sm font-semibold ${
        isIn ? 'text-[var(--success-soft-foreground)]' : 'text-danger'
      }`}
    >
      {isIn ? <ArrowDownLeft size={14} /> : <ArrowUpRight size={14} />}
      {isIn ? '+' : '−'}
      {NUMBER.format(movement.quantity)}{' '}
      {movement.item ? UNIT_SYMBOLS[movement.item.unit] : ''}
    </span>
  );
}

function MovementCard({ movement }: { movement: StockMovement }) {
  return (
    <div className="flex flex-col gap-1.5 rounded-xl border border-border bg-card p-3.5 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <Link
          className="font-mono text-[15px] font-semibold text-(--accent) hover:underline"
          to={`/inventario/${movement.itemId}`}
        >
          {movement.item?.sku ?? movement.itemId}
        </Link>
        <DirectionMark movement={movement} />
      </div>
      <span className="text-sm text-muted-foreground">
        {movement.item?.name}
      </span>
      <span className="text-sm text-foreground">{movementLabel(movement)}</span>
      <div className="flex flex-wrap items-center gap-x-3 text-xs text-muted-foreground">
        <span>{movement.branch?.name}</span>
        <span>{DATE.format(new Date(movement.occurredAt))}</span>
        <span>
          Saldo:{' '}
          <span className="font-mono">
            {NUMBER.format(movement.resultingBalance)}
          </span>
        </span>
        {movement.documentNumber ? (
          <span className="font-mono">Doc. {movement.documentNumber}</span>
        ) : null}
      </div>
    </div>
  );
}

export function MovimientosView() {
  const isDesktop = useMediaQuery(DESKTOP_QUERY);
  const { data: branches } = useBranches({ isActive: true });

  const [branchId, setBranchId] = useState(ALL_BRANCHES);
  const [kind, setKind] = useState<Kind>(ALL_KINDS);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const { data, isPending, isError, error } = useMovements({
    ...(branchId === ALL_BRANCHES ? {} : { branchId }),
    ...KIND_FILTERS[kind],
    // El backend espera ISO-8601; el input entrega `YYYY-MM-DD`. El "hasta"
    // se estira al final del día o dejaría fuera lo de esa misma jornada.
    ...(from ? { from: `${from}T00:00:00.000Z` } : {}),
    ...(to ? { to: `${to}T23:59:59.999Z` } : {}),
    limit: 200,
  });

  const movements = data ?? [];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <span className="text-[11px] font-medium tracking-[0.14em] text-(--eyebrow-color) uppercase">
          SMI · Inventario
        </span>
        <h1 className="font-display text-[28px] font-semibold tracking-[-0.03em] text-foreground">
          Historial de inventario
        </h1>
        <p className="text-sm text-muted-foreground">
          Todo lo que entró, salió, se traspasó o se ajustó, en orden. Cada
          renglón deja el saldo que quedó en esa bodega.{' '}
          <Link className="text-(--accent) hover:underline" to="/inventario">
            Volver al inventario
          </Link>
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Select
          onChange={(value) => {
            if (value) setBranchId(String(value));
          }}
          value={branchId}
        >
          <Label>Sucursal</Label>
          <Select.Trigger>
            <Select.Value />
            <Select.Indicator />
          </Select.Trigger>
          <Select.Popover>
            <ListBox>
              <ListBox.Item id={ALL_BRANCHES} textValue="Todas las sucursales">
                Todas las sucursales
                <ListBox.ItemIndicator />
              </ListBox.Item>
              {(branches ?? []).map((branch: Branch) => (
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

        <TextField onChange={setFrom} type="date" value={from}>
          <Label>Desde</Label>
          <Input />
        </TextField>

        <TextField onChange={setTo} type="date" value={to}>
          <Label>Hasta</Label>
          <Input />
        </TextField>
      </div>

      <Segmented
        label="Tipo de movimiento"
        onChange={setKind}
        options={[
          { id: ALL_KINDS, label: 'Todos' },
          { id: 'entradas', label: 'Entradas' },
          { id: 'salidas', label: 'Salidas' },
          { id: 'traspasos', label: 'Traspasos' },
          { id: 'ajustes', label: 'Ajustes' },
        ]}
        value={kind}
      />

      {isError ? (
        <div className="rounded-lg bg-danger-soft px-4 py-3 text-sm text-danger-soft-foreground">
          {error instanceof Error
            ? error.message
            : 'No se pudo obtener el historial.'}
        </div>
      ) : null}

      {isPending ? (
        <div className="flex justify-center py-16">
          <Spinner color="accent" size="lg" />
        </div>
      ) : movements.length === 0 ? (
        <div className="flex flex-col items-center gap-1 rounded-lg border border-dashed border-border py-16 text-center">
          <p className="text-sm font-medium text-foreground">
            No hay movimientos en este período
          </p>
          <p className="text-sm text-muted-foreground">
            Cambia el rango de fechas, la sucursal o el tipo.
          </p>
        </div>
      ) : !isDesktop ? (
        <div className="flex flex-col gap-2.5">
          {movements.map((movement) => (
            <MovementCard key={movement.id} movement={movement} />
          ))}
        </div>
      ) : (
        <Table variant="secondary">
          <Table.ScrollContainer>
            <Table.Content
              aria-label="Historial de inventario"
              className="min-w-240"
            >
              <Table.Header>
                <Table.Column isRowHeader>Fecha</Table.Column>
                <Table.Column>Ítem</Table.Column>
                <Table.Column>Sucursal</Table.Column>
                <Table.Column>Movimiento</Table.Column>
                <Table.Column>Cantidad</Table.Column>
                <Table.Column>Saldo</Table.Column>
                <Table.Column>Documento</Table.Column>
              </Table.Header>
              <Table.Body>
                {movements.map((movement) => (
                  <Table.Row key={movement.id}>
                    <Table.Cell className="font-mono text-sm text-muted-foreground">
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
                        <span className="text-xs text-muted-foreground">
                          {movement.item?.name}
                        </span>
                      </div>
                    </Table.Cell>
                    <Table.Cell className="text-sm text-foreground">
                      {movement.branch?.name ?? '—'}
                    </Table.Cell>
                    <Table.Cell className="text-sm text-muted-foreground">
                      {movementLabel(movement)}
                    </Table.Cell>
                    <Table.Cell>
                      <DirectionMark movement={movement} />
                    </Table.Cell>
                    <Table.Cell className="font-mono text-sm text-muted-foreground">
                      {NUMBER.format(movement.resultingBalance)}
                    </Table.Cell>
                    <Table.Cell className="font-mono text-sm text-muted-foreground">
                      {movement.documentNumber ?? '—'}
                    </Table.Cell>
                  </Table.Row>
                ))}
              </Table.Body>
            </Table.Content>
          </Table.ScrollContainer>
        </Table>
      )}
    </div>
  );
}
