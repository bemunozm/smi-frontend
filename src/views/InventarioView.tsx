import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Button,
  Input,
  Label,
  ListBox,
  Select,
  Spinner,
  Table,
  TextField,
} from '@heroui/react';
import { ArrowLeftRight, Pencil, ScrollText, Trash2 } from 'lucide-react';

import { CategoriesModal } from '../components/inventario/CategoriesModal';
import {
  ItemActionsModal,
  type ItemAction,
} from '../components/inventario/ItemActionsModal';
import { ItemCard } from '../components/inventario/ItemCard';
import {
  EditItemModal,
  NewItemModal,
} from '../components/inventario/ItemFormModal';
import {
  ALL_BRANCHES,
  BranchBreakdown,
  CriticalBadge,
  NUMBER,
  RowAction,
  Segmented,
  StatusChip,
  stockStatus,
} from '../components/inventario/shared';
import { useBranches } from '../hooks/useBranches';
import { useCategories } from '../hooks/useCategories';
import { useCurrentUser } from '../hooks/useCurrentUser';
import { useItems } from '../hooks/useInventory';
import { DESKTOP_QUERY, useMediaQuery } from '../hooks/useMediaQuery';
import { useUiStore } from '../store/ui';
import { ROLES } from '../types/roles';
import type { Branch } from '../types/branch';
import {
  UNIT_SYMBOLS,
  quantityAt,
  stockAt,
  totalQuantity,
  type InventoryItem,
  type ItemType,
} from '../types/inventory';

/** Centinela del filtro de categoría: "todas" no es un id. */
const ALL_CATEGORIES = '__all__';

type StockFilter = 'todos' | 'alerta';

/** Qué abre cada icono de la fila. */
export interface RowTarget {
  item: InventoryItem;
  view: ItemAction;
}

const ICON = 16;

// --- Fila de escritorio ----------------------------------------------------

function ItemRow({
  item,
  branchId,
  canWrite,
  isAdmin,
  onOpen,
  onEdit,
}: {
  item: InventoryItem;
  branchId: string;
  canWrite: boolean;
  isAdmin: boolean;
  onOpen: (view: ItemAction) => void;
  onEdit: () => void;
}) {
  const navigate = useNavigate();
  const isAll = branchId === ALL_BRANCHES;
  const quantity = isAll ? totalQuantity(item) : quantityAt(item, branchId);
  const minimum = isAll ? 0 : (stockAt(item, branchId)?.minimumQuantity ?? 0);
  const status = stockStatus(item, branchId);

  return (
    <Table.Row>
      <Table.Cell>
        <Link
          className="font-mono text-sm font-medium text-(--accent) hover:underline"
          to={`/inventario/${item.id}`}
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
            <span className="font-mono text-xs text-muted-foreground">
              {item.partNumber}
            </span>
          ) : null}
        </div>
      </Table.Cell>
      <Table.Cell className="text-sm text-muted-foreground">
        {item.category?.name ?? 'Sin categoría'}
      </Table.Cell>
      <Table.Cell>
        <BranchBreakdown
          highlightBranchId={isAll ? undefined : branchId}
          item={item}
        />
      </Table.Cell>
      <Table.Cell
        className={`font-mono text-sm ${
          status.tone === 'peligro'
            ? 'font-semibold text-danger'
            : 'text-foreground'
        }`}
      >
        {NUMBER.format(quantity)} {UNIT_SYMBOLS[item.unit]}
      </Table.Cell>
      {isAll ? null : (
        <Table.Cell className="font-mono text-sm text-muted-foreground">
          {minimum > 0 ? NUMBER.format(minimum) : '—'}
        </Table.Cell>
      )}
      <Table.Cell>
        <StatusChip label={status.label} tone={status.tone} />
      </Table.Cell>
      <Table.Cell>
        {/* Cuatro acciones, siempre las mismas y en el mismo orden. Antes eran
            seis enlaces más un campo de cantidad con `+`/`−`, y había que
            leerlos todos para encontrar el que se buscaba. */}
        <div className="flex items-center justify-end gap-1.5">
          {isAdmin ? (
            <RowAction
              icon={<Pencil size={ICON} />}
              label="Editar ítem"
              onPress={onEdit}
            />
          ) : null}
          {canWrite ? (
            <RowAction
              icon={<ArrowLeftRight size={ICON} />}
              label="Registrar movimiento"
              onPress={() => onOpen('movement')}
            />
          ) : null}
          <RowAction
            icon={<ScrollText size={ICON} />}
            label="Ver historial"
            onPress={() => void navigate(`/inventario/${item.id}`)}
          />
          {isAdmin ? (
            <RowAction
              icon={<Trash2 size={ICON} />}
              isDanger
              label="Eliminar ítem"
              onPress={() => onOpen('delete')}
            />
          ) : null}
        </div>
      </Table.Cell>
    </Table.Row>
  );
}

// --- Listado ---------------------------------------------------------------

function EmptyState() {
  return (
    <div className="flex flex-col items-center gap-1 rounded-lg border border-dashed border-border py-16 text-center">
      <p className="text-sm font-medium text-foreground">
        No hay ítems que coincidan
      </p>
      <p className="text-sm text-muted-foreground">
        Ajusta la búsqueda o el filtro, o crea un ítem nuevo.
      </p>
    </div>
  );
}

function ItemsList({
  items,
  branchId,
  canWrite,
  isAdmin,
  onOpen,
  onEdit,
}: {
  items: InventoryItem[];
  branchId: string;
  canWrite: boolean;
  isAdmin: boolean;
  onOpen: (item: InventoryItem, view: ItemAction) => void;
  onEdit: (item: InventoryItem) => void;
}) {
  const isDesktop = useMediaQuery(DESKTOP_QUERY);
  const isAll = branchId === ALL_BRANCHES;

  if (items.length === 0) return <EmptyState />;

  // Tarjetas en teléfono Y en tablet; la tabla aparece recién en escritorio.
  if (!isDesktop) {
    return (
      <div className="flex flex-col gap-2.5">
        {items.map((item) => (
          <ItemCard
            branchId={branchId}
            item={item}
            key={item.id}
            onOpen={() => onOpen(item, 'actions')}
          />
        ))}
      </div>
    );
  }

  return (
    <Table variant="secondary">
      <Table.ScrollContainer>
        <Table.Content aria-label="Inventario" className="min-w-260">
          <Table.Header>
            <Table.Column isRowHeader>SKU</Table.Column>
            <Table.Column>Nombre</Table.Column>
            <Table.Column>Categoría</Table.Column>
            <Table.Column>Sucursal</Table.Column>
            <Table.Column>{isAll ? 'Stock total' : 'Stock acá'}</Table.Column>
            {isAll ? null : <Table.Column>Mínimo</Table.Column>}
            <Table.Column>Estado</Table.Column>
            <Table.Column>Acciones</Table.Column>
          </Table.Header>
          <Table.Body>
            {items.map((item) => (
              <ItemRow
                branchId={branchId}
                canWrite={canWrite}
                isAdmin={isAdmin}
                item={item}
                key={item.id}
                onEdit={() => onEdit(item)}
                onOpen={(view) => onOpen(item, view)}
              />
            ))}
          </Table.Body>
        </Table.Content>
      </Table.ScrollContainer>
    </Table>
  );
}

// --- Vista -----------------------------------------------------------------

export function InventarioView() {
  const { user } = useCurrentUser();
  const isAdmin = user?.role === ROLES.ADMIN;
  const canWrite = isAdmin || user?.role === ROLES.MANTENEDOR;

  const selectedBranchId = useUiStore((state) => state.selectedBranchId);
  const setSelectedBranchId = useUiStore((state) => state.setSelectedBranchId);

  const [tab, setTab] = useState<ItemType>('SUPPLY');
  const [search, setSearch] = useState('');
  const [categoryId, setCategoryId] = useState(ALL_CATEGORIES);
  const [stockFilter, setStockFilter] = useState<StockFilter>('todos');

  const [target, setTarget] = useState<RowTarget | null>(null);
  const [editItem, setEditItem] = useState<InventoryItem | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  const { data: branches } = useBranches({ isActive: true });
  const { data: categories } = useCategories();

  /**
   * El inventario **general** es lo que se ve primero: con dos faenas, la
   * pregunta de partida es "¿cuánto hay en la empresa?", y recién después "¿en
   * cuál?". Elegir una sucursal es un filtro, no el punto de entrada.
   */
  const branchId = selectedBranchId ?? ALL_BRANCHES;
  const branchName =
    branches?.find((branch) => branch.id === branchId)?.name ?? '';

  const { data, isPending, isError, error } = useItems({
    type: tab,
    isActive: true,
    ...(search.trim() ? { q: search.trim() } : {}),
    ...(categoryId === ALL_CATEGORIES ? {} : { categoryId }),
  });

  const all = useMemo(() => data ?? [], [data]);

  const alertCount = useMemo(
    () =>
      all.filter((item) => stockStatus(item, branchId).tone !== 'ok').length,
    [all, branchId],
  );

  const items = useMemo(
    () =>
      stockFilter === 'alerta'
        ? all.filter((item) => stockStatus(item, branchId).tone !== 'ok')
        : all,
    [all, stockFilter, branchId],
  );

  // La ficha se abre desde su propio modal: se cierra el panel y se abre el
  // otro para no apilar dos.
  const openEdit = (item: InventoryItem): void => {
    setTarget(null);
    setEditItem(item);
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1.5">
          <span className="text-[11px] font-medium tracking-[0.14em] text-(--eyebrow-color) uppercase">
            SMI · Inventario
          </span>
          <h1 className="font-display text-[28px] font-semibold tracking-[-0.03em] text-foreground">
            Inventario
          </h1>
          <p className="text-sm text-muted-foreground">
            {branchId === ALL_BRANCHES
              ? 'Existencias de suministros y repuestos en toda la empresa, con el desglose por sucursal.'
              : `Existencias de suministros y repuestos en ${branchName}, con su mínimo de reposición.`}
          </p>
        </div>
        <div className="hidden items-center gap-2 sm:flex">
          <Link
            className="inline-flex h-10 items-center rounded-lg border border-border bg-card px-4 text-sm font-semibold text-foreground hover:bg-[var(--surface-secondary)]"
            to="/inventario/movimientos"
          >
            Historial
          </Link>
          {isAdmin ? <CategoriesModal /> : null}
          {isAdmin ? (
            <Button onPress={() => setIsCreating(true)}>Nuevo ítem</Button>
          ) : null}
        </div>
      </div>

      <Segmented
        label="Tipo de ítem"
        onChange={setTab}
        options={[
          { id: 'SUPPLY', label: 'Suministros' },
          { id: 'PART', label: 'Repuestos' },
        ]}
        value={tab}
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Select
          onChange={(value) => {
            if (value) setSelectedBranchId(String(value));
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
                <ListBox.Item
                  id={category.id}
                  key={category.id}
                  textValue={category.name}
                >
                  {category.name}
                  <ListBox.ItemIndicator />
                </ListBox.Item>
              ))}
            </ListBox>
          </Select.Popover>
        </Select>

        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-(--label-color)">
            Existencias
          </span>
          {/* El filtro agrupa ámbar y rojo: los dos piden una decisión de
              compra, y separarlos obligaba a mirar dos listas. */}
          <Segmented
            label="Filtro de existencias"
            onChange={setStockFilter}
            options={[
              { id: 'todos', label: `Todos · ${all.length}` },
              { id: 'alerta', label: `Con alerta · ${alertCount}` },
            ]}
            value={stockFilter}
          />
        </div>
      </div>

      <div className="flex gap-2 sm:hidden">
        <Link
          className="inline-flex h-10 flex-1 items-center justify-center rounded-lg border border-border bg-card px-4 text-sm font-semibold text-foreground"
          to="/inventario/movimientos"
        >
          Historial
        </Link>
        {isAdmin ? <CategoriesModal /> : null}
        {isAdmin ? (
          <Button className="flex-1" onPress={() => setIsCreating(true)}>
            Nuevo ítem
          </Button>
        ) : null}
      </div>

      {isError ? (
        <div className="rounded-lg bg-danger-soft px-4 py-3 text-sm text-danger-soft-foreground">
          {error instanceof Error
            ? error.message
            : 'No se pudo obtener el inventario.'}
        </div>
      ) : null}

      {isPending ? (
        <div className="flex justify-center py-16">
          <Spinner color="accent" size="lg" />
        </div>
      ) : (
        <ItemsList
          branchId={branchId}
          canWrite={canWrite}
          isAdmin={isAdmin}
          items={items}
          onEdit={openEdit}
          onOpen={(item, view) => setTarget({ item, view })}
        />
      )}

      {target ? (
        <ItemActionsModal
          branchId={branchId}
          branches={branches ?? []}
          canWrite={canWrite}
          initialView={target.view}
          isAdmin={isAdmin}
          isOpen
          item={target.item}
          onEdit={() => openEdit(target.item)}
          onOpenChange={(open) => !open && setTarget(null)}
        />
      ) : null}

      {editItem ? (
        <EditItemModal
          branches={branches ?? []}
          isOpen
          item={editItem}
          onOpenChange={(open) => !open && setEditItem(null)}
        />
      ) : null}

      {isCreating ? (
        <NewItemModal
          branchId={branchId === ALL_BRANCHES ? (branches?.[0]?.id ?? '') : branchId}
          branchName={
            branchId === ALL_BRANCHES
              ? (branches?.[0]?.name ?? '')
              : branchName
          }
          defaultType={tab}
          isOpen
          onOpenChange={setIsCreating}
        />
      ) : null}
    </div>
  );
}
