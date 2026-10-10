import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Input, Label, ListBox, Select, Spinner, Table, TextField } from '@heroui/react';
import { History, Info } from 'lucide-react';

import { ItemCard } from '../components/inventario/ItemCard';
import {
  CriticalBadge,
  NUMBER,
  Segmented,
  StatusChip,
  stockStatus,
} from '../components/inventario/shared';
import { useBranches } from '../hooks/useBranches';
import { useCategories } from '../hooks/useCategories';
import { useItems } from '../hooks/useInventory';
import { TABLE_LAYOUT_QUERY, useMediaQuery } from '../hooks/useMediaQuery';
import {
  UNIT_SYMBOLS,
  quantityAt,
  stockAt,
  type InventoryItem,
  type ItemType,
} from '../types/inventory';

/** Centinela del filtro de categoría: "todas" no es un id. */
const ALL_CATEGORIES = '__all__';

const COLUMN_CLASS = 'text-xs font-bold tracking-[0.06em] uppercase';

// --- Fila de escritorio ----------------------------------------------------

/** La fila de `InventarioView` sin acciones ni desglose por sucursal: acá la
 * bodega es una sola (Faena), así que la columna "Sucursal" no dice nada. */
function ItemRow({ item, branchId }: { item: InventoryItem; branchId: string }) {
  const quantity = quantityAt(item, branchId);
  const minimum = stockAt(item, branchId)?.minimumQuantity ?? 0;
  const status = stockStatus(item, branchId);

  return (
    <Table.Row>
      <Table.Cell>
        {/* La ficha montada en el shell del taller: la barra no cambia. */}
        <Link
          className="font-mono text-sm font-medium text-(--accent) hover:underline"
          to={`/mantenimiento/stock/${item.id}`}
        >
          {item.sku}
        </Link>
      </Table.Cell>
      <Table.Cell>
        <div className="flex flex-col">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-foreground">{item.name}</span>
            {item.isCritical ? <CriticalBadge /> : null}
          </div>
          {item.partNumber ? (
            <span className="font-mono text-xs text-muted-foreground">{item.partNumber}</span>
          ) : null}
        </div>
      </Table.Cell>
      <Table.Cell className="text-sm text-muted-foreground">
        {item.category?.name ?? 'Sin categoría'}
      </Table.Cell>
      <Table.Cell
        className={`font-mono text-sm ${
          status.tone === 'peligro' ? 'font-semibold text-danger' : 'text-foreground'
        }`}
      >
        {NUMBER.format(quantity)} {UNIT_SYMBOLS[item.unit]}
      </Table.Cell>
      <Table.Cell className="font-mono text-sm text-muted-foreground">
        {minimum > 0 ? NUMBER.format(minimum) : '—'}
      </Table.Cell>
      <Table.Cell>
        <StatusChip label={status.label} tone={status.tone} />
      </Table.Cell>
    </Table.Row>
  );
}

// --- Listado ---------------------------------------------------------------

function EmptyState() {
  return (
    <div className="flex flex-col items-center gap-1 rounded-lg border border-dashed border-border py-16 text-center">
      <p className="text-sm font-medium text-foreground">No hay ítems que coincidan</p>
      <p className="text-sm text-muted-foreground">Ajusta la búsqueda o el filtro.</p>
    </div>
  );
}

function ItemsList({ items, branchId }: { items: InventoryItem[]; branchId: string }) {
  const isDesktop = useMediaQuery(TABLE_LAYOUT_QUERY);
  const navigate = useNavigate();

  if (items.length === 0) return <EmptyState />;

  // Tarjetas en teléfono Y en tablet, igual que Inventario — pero acá la
  // tarjeta abre la ficha del ítem: no hay hoja de acciones que abrir.
  if (!isDesktop) {
    return (
      <div className="flex flex-col gap-2.5">
        {items.map((item) => (
          <ItemCard
            ariaLabel={`Ver ficha de ${item.sku}`}
            branchId={branchId}
            item={item}
            key={item.id}
            marca={null}
            onOpen={() => void navigate(`/mantenimiento/stock/${item.id}`)}
          />
        ))}
      </div>
    );
  }

  return (
    <Table variant="secondary">
      <Table.ScrollContainer>
        <Table.Content aria-label="Stock del taller" className="min-w-160">
          <Table.Header>
            <Table.Column className={COLUMN_CLASS} isRowHeader>
              SKU
            </Table.Column>
            <Table.Column className={COLUMN_CLASS}>Nombre</Table.Column>
            <Table.Column className={COLUMN_CLASS}>Categoría</Table.Column>
            <Table.Column className={COLUMN_CLASS}>Existencia en Faena</Table.Column>
            <Table.Column className={COLUMN_CLASS}>Mínimo</Table.Column>
            <Table.Column className={COLUMN_CLASS}>Estado</Table.Column>
          </Table.Header>
          <Table.Body>
            {items.map((item) => (
              <ItemRow branchId={branchId} item={item} key={item.id} />
            ))}
          </Table.Body>
        </Table.Content>
      </Table.ScrollContainer>
    </Table>
  );
}

// --- Vista -----------------------------------------------------------------

/**
 * Sub-vista "Stock" del taller: el inventario del administrador
 * (`InventarioView`) en **solo lectura y solo Faena** — mismas pestañas,
 * búsqueda y categorías, pero sin crear, editar, eliminar ni registrar
 * movimientos, sin filtro de sucursal (la bodega del taller es SIEMPRE la de
 * faena, la misma regla de `FinishTaskModal`) y sin filtro de estado. El
 * taller no mueve stock a mano: cada salida nace de finalizar una operación.
 */
export function WorkshopStockView() {
  const [tab, setTab] = useState<ItemType>('SUPPLY');
  const [search, setSearch] = useState('');
  const [categoryId, setCategoryId] = useState(ALL_CATEGORIES);

  const { data: branches } = useBranches({ isActive: true });
  // Las categorías siguen a la pestaña, igual que en Inventario.
  const { data: categories } = useCategories({ type: tab });

  // Regla del taller: la bodega es SIEMPRE la de FAENA (ver `FinishTaskModal`).
  const faenaBranch = useMemo(
    () => branches?.find((branch) => /faena/i.test(branch.name)),
    [branches],
  );

  const { data, isPending, isError, error } = useItems({
    type: tab,
    isActive: true,
    ...(search.trim() ? { q: search.trim() } : {}),
    ...(categoryId === ALL_CATEGORIES ? {} : { categoryId }),
  });

  /**
   * Solo la existencia de Faena: se recortan los stocks de las demás bodegas
   * ANTES de pintar, así ninguna pieza (tarjeta, desglose, estado) puede
   * mostrar cifras de Casa Matriz por accidente.
   */
  const items = useMemo(() => {
    if (!faenaBranch) return [];
    return (data ?? []).map((item) => ({
      ...item,
      stocks: item.stocks.filter((stock) => stock.branchId === faenaBranch.id),
    }));
  }, [data, faenaBranch]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 className="font-display text-xl font-semibold tracking-[-0.02em] text-foreground">
          Stock del taller
        </h2>
        <p className="text-sm text-muted-foreground">
          Existencias de suministros y repuestos{' '}
          <strong className="font-semibold text-foreground">
            en {faenaBranch?.name ?? 'Faena'}
          </strong>
          , en solo lectura.
        </p>
      </div>

      <div className="flex items-start gap-2.5 rounded-2xl bg-[var(--accent-soft)] px-3.5 py-3 text-[13px] leading-5 text-[var(--accent-soft-foreground)]">
        <Info className="mt-0.5 h-4 w-4 shrink-0" />
        <span>
          Acá no se mueve stock a mano: cada insumo usado al{' '}
          <strong>finalizar una tarea</strong> se descuenta automáticamente y queda como salida
          trazable, ligada a su OT.
        </span>
      </div>

      <div className="flex flex-wrap gap-2">
        {/* Dentro del shell del taller: la barra del módulo no cambia. */}
        <Link
          className="inline-flex h-10 items-center gap-2 rounded-lg border border-border bg-card px-4 text-sm font-semibold text-foreground hover:bg-[var(--surface-secondary)]"
          to="/mantenimiento/stock/movimientos"
        >
          <History size={16} />
          Historial de movimientos
        </Link>
      </div>

      <Segmented
        label="Tipo de ítem"
        onChange={(next) => {
          setTab(next);
          // La categoría elegida puede no existir en la otra pestaña.
          setCategoryId(ALL_CATEGORIES);
        }}
        options={[
          { id: 'SUPPLY', label: 'Suministros' },
          { id: 'PART', label: 'Repuestos' },
        ]}
        value={tab}
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <TextField aria-label="Buscar ítem" onChange={setSearch} value={search}>
          <Label>Buscar</Label>
          <Input placeholder="SKU, nombre o nº de parte" />
        </TextField>

        <Select
          onChange={(value) => {
            if (value) setCategoryId(String(value));
          }}
          value={categoryId}
        >
          <Label>Categoría</Label>
          <Select.Trigger>
            <Select.Value />
            <Select.Indicator />
          </Select.Trigger>
          <Select.Popover>
            <ListBox>
              <ListBox.Item id={ALL_CATEGORIES} textValue="Todas">
                Todas
                <ListBox.ItemIndicator />
              </ListBox.Item>
              {(categories ?? []).map((category) => (
                <ListBox.Item id={category.id} key={category.id} textValue={category.name}>
                  {category.name}
                  <ListBox.ItemIndicator />
                </ListBox.Item>
              ))}
            </ListBox>
          </Select.Popover>
        </Select>
      </div>

      {isError ? (
        <div
          className="rounded-lg bg-danger-soft px-4 py-3 text-sm text-danger-soft-foreground"
          role="alert"
        >
          {error instanceof Error ? error.message : 'No se pudo obtener el inventario.'}
        </div>
      ) : null}

      {!isPending && branches && !faenaBranch ? (
        <div
          className="rounded-lg bg-danger-soft px-4 py-3 text-sm text-danger-soft-foreground"
          role="alert"
        >
          No hay una bodega de faena activa en Inventario — el stock del taller vive ahí. Crea o
          reactiva la bodega "Faena" para ver existencias.
        </div>
      ) : isPending ? (
        <div className="flex justify-center py-16">
          <Spinner color="accent" size="lg" />
        </div>
      ) : faenaBranch ? (
        <ItemsList branchId={faenaBranch.id} items={items} />
      ) : null}
    </div>
  );
}
