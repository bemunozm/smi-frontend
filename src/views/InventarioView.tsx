import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Button,
  Input,
  Label,
  ListBox,
  Modal,
  Select,
  Spinner,
  Table,
  TextField,
} from '@heroui/react';
import {
  ArrowLeftRight,
  FileText,
  History,
  Pencil,
  Trash2,
} from 'lucide-react';

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
  RowMenu,
  Segmented,
  StatusChip,
  stockStatus,
  type RowMenuOption,
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

/**
 * Hasta cuántas sucursales caben como control segmentado antes de volver al
 * desplegable. El diseño las dibuja segmentadas («Todas · Norte · Sur»), que se
 * lee y se aprieta más rápido — pero solo mientras entren en el ancho.
 */
const MAX_SEGMENTED_BRANCHES = 3;

type StockFilter = 'todos' | 'atencion';

interface RowTarget {
  item: InventoryItem;
  view: ItemAction;
}

const MENU_ICON = 15;

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

  const options: RowMenuOption[] = [
    ...(isAdmin
      ? [
          {
            id: 'edit',
            label: 'Editar ítem',
            icon: <Pencil size={MENU_ICON} />,
          },
        ]
      : []),
    ...(canWrite
      ? [
          {
            id: 'movement',
            label: 'Registrar movimiento',
            icon: <ArrowLeftRight size={MENU_ICON} />,
          },
        ]
      : []),
    { id: 'ficha', label: 'Ver ficha', icon: <FileText size={MENU_ICON} /> },
    ...(isAdmin
      ? [
          {
            id: 'delete',
            label: 'Eliminar ítem',
            icon: <Trash2 size={MENU_ICON} />,
            isDanger: true,
          },
        ]
      : []),
  ];

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
      <Table.Cell
        className={`font-mono text-sm ${
          status.tone === 'peligro'
            ? 'font-semibold text-danger'
            : 'text-foreground'
        }`}
      >
        {NUMBER.format(quantity)} {UNIT_SYMBOLS[item.unit]}
      </Table.Cell>
      <Table.Cell>
        <BranchBreakdown
          highlightBranchId={isAll ? undefined : branchId}
          item={item}
        />
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
        <div className="flex justify-end">
          <RowMenu
            label={`Acciones de ${item.sku}`}
            onAction={(id) => {
              if (id === 'edit') return onEdit();
              if (id === 'ficha') return void navigate(`/inventario/${item.id}`);
              onOpen(id as ItemAction);
            }}
            options={options}
          />
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

const COLUMN_CLASS = 'text-xs font-bold tracking-[0.06em] uppercase';

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
        <Table.Content aria-label="Inventario" className="min-w-240">
          <Table.Header>
            <Table.Column className={COLUMN_CLASS} isRowHeader>
              SKU
            </Table.Column>
            <Table.Column className={COLUMN_CLASS}>Nombre</Table.Column>
            <Table.Column className={COLUMN_CLASS}>Categoría</Table.Column>
            <Table.Column className={COLUMN_CLASS}>
              {isAll ? 'Existencia · total' : 'Existencia acá'}
            </Table.Column>
            <Table.Column className={COLUMN_CLASS}>Sucursal</Table.Column>
            {isAll ? null : (
              <Table.Column className={COLUMN_CLASS}>Mínimo</Table.Column>
            )}
            <Table.Column className={COLUMN_CLASS}>Estado</Table.Column>
            <Table.Column className={COLUMN_CLASS}>Acciones</Table.Column>
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

// --- Elegir ítem para un movimiento suelto ---------------------------------

/**
 * El botón «Registrar movimiento» de la cabecera no sabe sobre qué ítem se va a
 * mover material, así que lo pregunta primero. Es el camino del bodeguero que
 * llega con la guía en la mano y busca el ítem, en vez del que ya lo tiene a la
 * vista en su fila.
 */
function PickItemModal({
  items,
  isOpen,
  onOpenChange,
  onPick,
}: {
  items: InventoryItem[];
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onPick: (item: InventoryItem) => void;
}) {
  const [itemId, setItemId] = useState('');

  return (
    <Modal.Backdrop isOpen={isOpen} onOpenChange={onOpenChange}>
      <Modal.Container>
        <Modal.Dialog className="sm:max-w-md">
          {({ close }) => (
            <>
              <Modal.CloseTrigger />
              <Modal.Header>
                <Modal.Heading className="font-display text-xl font-semibold tracking-[-0.02em]">
                  Registrar movimiento
                </Modal.Heading>
              </Modal.Header>
              <Modal.Body>
                <Select
                  fullWidth
                  onChange={(value) => {
                    if (value) setItemId(String(value));
                  }}
                  value={itemId}
                >
                  <Label>¿Sobre qué ítem?</Label>
                  <Select.Trigger>
                    <Select.Value />
                    <Select.Indicator />
                  </Select.Trigger>
                  <Select.Popover>
                    <ListBox>
                      {items.map((item) => (
                        <ListBox.Item
                          id={item.id}
                          key={item.id}
                          textValue={`${item.sku} · ${item.name}`}
                        >
                          {item.sku} · {item.name}
                          <ListBox.ItemIndicator />
                        </ListBox.Item>
                      ))}
                    </ListBox>
                  </Select.Popover>
                </Select>
              </Modal.Body>
              <Modal.Footer>
                <Button onPress={close} variant="secondary">
                  Cancelar
                </Button>
                <Button
                  isDisabled={!itemId}
                  onPress={() => {
                    const picked = items.find((item) => item.id === itemId);
                    if (picked) onPick(picked);
                  }}
                >
                  Continuar
                </Button>
              </Modal.Footer>
            </>
          )}
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
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
  const [isPicking, setIsPicking] = useState(false);

  const { data: branches } = useBranches({ isActive: true });
  // Las categorías siguen a la pestaña: ofrecer «Neumáticos y llantas»
  // mirando suministros lleva a un listado vacío y a creer que se perdió stock.
  const { data: categories } = useCategories({ type: tab });

  /**
   * El inventario **general** es lo que se ve primero: con dos faenas, la
   * pregunta de partida es "¿cuánto hay en la empresa?", y recién después "¿en
   * cuál?". Elegir una sucursal es un filtro, no el punto de entrada.
   */
  const branchId = selectedBranchId ?? ALL_BRANCHES;

  const { data, isPending, isError, error } = useItems({
    type: tab,
    isActive: true,
    ...(search.trim() ? { q: search.trim() } : {}),
    ...(categoryId === ALL_CATEGORIES ? {} : { categoryId }),
  });

  const all = useMemo(() => data ?? [], [data]);

  const alertCount = useMemo(
    () => all.filter((item) => stockStatus(item, branchId).tone !== 'ok').length,
    [all, branchId],
  );

  const items = useMemo(
    () =>
      stockFilter === 'atencion'
        ? all.filter((item) => stockStatus(item, branchId).tone !== 'ok')
        : all,
    [all, stockFilter, branchId],
  );

  const branchOptions = [
    { id: ALL_BRANCHES, label: 'Todas' },
    ...(branches ?? []).map((branch: Branch) => ({
      id: branch.id,
      label: branch.name,
    })),
  ];
  const useSegmentedBranches =
    branchOptions.length <= MAX_SEGMENTED_BRANCHES + 1;
  const branchLabel =
    branchOptions.find((option) => option.id === branchId)?.label ?? '';

  const openEdit = (item: InventoryItem): void => {
    setTarget(null);
    setEditItem(item);
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <span className="text-[11px] font-medium tracking-[0.14em] text-(--eyebrow-color) uppercase">
          SMI · Inventario
        </span>
        <h1 className="font-display text-[28px] font-semibold tracking-[-0.03em] text-foreground">
          Inventario general
        </h1>
        <p className="text-sm text-muted-foreground">
          Existencias de suministros y repuestos{' '}
          <strong className="font-semibold text-foreground">
            {branchId === ALL_BRANCHES
              ? 'en todas las sucursales'
              : `en ${branchLabel}`}
          </strong>
          , con semáforo de mínimos y trazabilidad de cada movimiento.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Link
          className="inline-flex h-10 items-center gap-2 rounded-lg border border-border bg-card px-4 text-sm font-semibold text-foreground hover:bg-[var(--surface-secondary)]"
          to="/inventario/movimientos"
        >
          <History size={16} />
          Historial general
        </Link>
        {canWrite ? (
          <Button onPress={() => setIsPicking(true)} variant="secondary">
            Registrar movimiento
          </Button>
        ) : null}
        {isAdmin ? <CategoriesModal /> : null}
        {isAdmin ? (
          <Button onPress={() => setIsCreating(true)}>Nuevo ítem</Button>
        ) : null}
      </div>

      <Segmented
        label="Tipo de ítem"
        onChange={(next) => {
          setTab(next);
          // La categoría elegida puede no existir en la otra pestaña; dejarla
          // puesta mostraría cero resultados sin explicar por qué.
          setCategoryId(ALL_CATEGORIES);
        }}
        options={[
          { id: 'SUPPLY', label: 'Suministros' },
          { id: 'PART', label: 'Repuestos' },
        ]}
        value={tab}
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <TextField aria-label="Buscar ítem" onChange={setSearch} value={search}>
          <Label>Buscar</Label>
          <Input placeholder="SKU, nombre o nº de parte" />
        </TextField>

        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-(--label-color)">
            Sucursal
          </span>
          {useSegmentedBranches ? (
            <Segmented
              label="Filtro de sucursal"
              onChange={setSelectedBranchId}
              options={branchOptions}
              value={branchId}
            />
          ) : (
            <Select
              aria-label="Sucursal"
              onChange={(value) => {
                if (value) setSelectedBranchId(String(value));
              }}
              value={branchId}
            >
              <Select.Trigger>
                <Select.Value />
                <Select.Indicator />
              </Select.Trigger>
              <Select.Popover>
                <ListBox>
                  {branchOptions.map((option) => (
                    <ListBox.Item
                      id={option.id}
                      key={option.id}
                      textValue={option.label}
                    >
                      {option.label}
                      <ListBox.ItemIndicator />
                    </ListBox.Item>
                  ))}
                </ListBox>
              </Select.Popover>
            </Select>
          )}
        </div>

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
            Estado
          </span>
          {/* El filtro junta ámbar y rojo: los dos piden una decisión de
              compra, y separarlos obligaba a mirar dos listas. */}
          <Segmented
            label="Filtro de estado"
            onChange={setStockFilter}
            options={[
              { id: 'todos', label: `Todos · ${all.length}` },
              { id: 'atencion', label: `Requieren atención · ${alertCount}` },
            ]}
            value={stockFilter}
          />
        </div>
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

      {isPicking ? (
        <PickItemModal
          isOpen
          items={all}
          onOpenChange={setIsPicking}
          onPick={(item) => {
            setIsPicking(false);
            setTarget({ item, view: 'movement' });
          }}
        />
      ) : null}

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
          branchId={
            branchId === ALL_BRANCHES ? (branches?.[0]?.id ?? '') : branchId
          }
          branchName={
            branchId === ALL_BRANCHES ? (branches?.[0]?.name ?? '') : branchLabel
          }
          defaultType={tab}
          isOpen
          onOpenChange={setIsCreating}
        />
      ) : null}
    </div>
  );
}
