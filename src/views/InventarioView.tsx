import { useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  Button,
  Card,
  Input,
  Label,
  ListBox,
  Modal,
  Select,
  Spinner,
  Switch,
  Table,
  TextField,
} from '@heroui/react';
import {
  ArrowLeftRight,
  FileText,
  History,
  PackageCheck,
  PackageMinus,
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
  InactiveBadge,
  NUMBER,
  RowMenu,
  Segmented,
  StatusChip,
  stockStatus,
  type RowMenuOption,
} from '../components/inventario/shared';
import { CEBRA_COLUMNAS, cabeceraDe, fondoColumna } from '../components/ui/tabla-pizarra';
import { useBranches } from '../hooks/useBranches';
import { useCategories } from '../hooks/useCategories';
import { usePermissions } from '../hooks/usePermissions';
import { MOVEMENT_ACTIONS } from '../lib/permissions';
import { MarcaPendiente } from '../components/sync/MarcaPendiente';
import { PendientesStrip } from '../components/sync/PendientesStrip';
import { useItems } from '../hooks/useInventory';
import { usePendingWrites, type MarcaPendiente as Marca } from '../hooks/usePendingWrites';
import { TABLE_LAYOUT_QUERY, useMediaQuery } from '../hooks/useMediaQuery';
import { RECURSOS_DE_INVENTARIO } from '../lib/pending-resources';
import { useUiStore } from '../store/ui';
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
  marca,
  branchId,
  onOpen,
  onEdit,
}: {
  item: InventoryItem;
  marca: Marca | null;
  branchId: string;
  onOpen: (view: ItemAction) => void;
  onEdit: () => void;
}) {
  const navigate = useNavigate();
  const { can, canAny } = usePermissions();
  const isAll = branchId === ALL_BRANCHES;
  const quantity = isAll ? totalQuantity(item) : quantityAt(item, branchId);
  const minimum = isAll ? 0 : (stockAt(item, branchId)?.minimumQuantity ?? 0);
  const status = stockStatus(item, branchId);

  const options: RowMenuOption[] = [
    ...(can('item.update')
      ? [
          {
            id: 'edit',
            label: 'Editar ítem',
            icon: <Pencil size={MENU_ICON} />,
          },
        ]
      : []),
    ...(canAny(MOVEMENT_ACTIONS)
      ? [
          {
            id: 'movement',
            label: 'Registrar movimiento',
            icon: <ArrowLeftRight size={MENU_ICON} />,
          },
        ]
      : []),
    { id: 'ficha', label: 'Ver ficha', icon: <FileText size={MENU_ICON} /> },
    ...(can('item.setActive')
      ? [
          {
            id: 'deactivate',
            label: item.isActive ? 'Dar de baja' : 'Reactivar',
            icon: item.isActive ? <PackageMinus size={MENU_ICON} /> : <PackageCheck size={MENU_ICON} />,
          },
        ]
      : []),
    ...(can('item.delete')
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

  // Índice lógico de cada columna para la cebra: «Mínimo» no existe en «Todas».
  const col = (nombre: (typeof COLUMNAS)[number]) => fondoColumna(columnasDe(isAll).indexOf(nombre));

  return (
    <Table.Row className={CEBRA_COLUMNAS}>
      <Table.Cell {...col('sku')}>
        <Link
          className="font-mono text-sm font-medium text-(--accent) hover:underline"
          to={`/inventario/${item.id}`}
        >
          {item.sku}
        </Link>
      </Table.Cell>
      <Table.Cell {...col('nombre')}>
        <div className="flex flex-col">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-foreground">{item.name}</span>
            {item.isCritical ? <CriticalBadge /> : null}
            {item.isActive ? null : <InactiveBadge />}
          </div>
          <MarcaPendiente marca={marca} />
          {item.partNumber ? (
            <span className="font-mono text-xs text-muted-foreground">
              {item.partNumber}
            </span>
          ) : null}
        </div>
      </Table.Cell>
      <Table.Cell className="text-sm text-muted-foreground" {...col('categoria')}>
        {item.category?.name ?? 'Sin categoría'}
      </Table.Cell>
      <Table.Cell
        className={`font-mono text-sm ${
          status.tone === 'peligro'
            ? 'font-semibold text-danger'
            : 'text-foreground'
        }`}
        {...col('existencia')}
      >
        {NUMBER.format(quantity)} {UNIT_SYMBOLS[item.unit]}
      </Table.Cell>
      <Table.Cell {...col('sucursal')}>
        <BranchBreakdown
          highlightBranchId={isAll ? undefined : branchId}
          item={item}
        />
      </Table.Cell>
      {isAll ? null : (
        <Table.Cell className="font-mono text-sm text-muted-foreground" {...col('minimo')}>
          {minimum > 0 ? NUMBER.format(minimum) : '—'}
        </Table.Cell>
      )}
      <Table.Cell {...col('estado')}>
        <StatusChip label={status.label} tone={status.tone} />
      </Table.Cell>
      <Table.Cell {...col('acciones')}>
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

/** Columnas de la tabla en orden; «Mínimo» solo con una sucursal elegida. */
const COLUMNAS = ['sku', 'nombre', 'categoria', 'existencia', 'sucursal', 'minimo', 'estado', 'acciones'] as const;

const columnasDe = (isAll: boolean): readonly (typeof COLUMNAS)[number][] =>
  isAll ? COLUMNAS.filter((c) => c !== 'minimo') : COLUMNAS;

function ItemsList({
  items,
  branchId,
  onOpen,
  onEdit,
}: {
  items: InventoryItem[];
  branchId: string;
  onOpen: (item: InventoryItem, view: ItemAction) => void;
  onEdit: (item: InventoryItem) => void;
}) {
  const isDesktop = useMediaQuery(TABLE_LAYOUT_QUERY);
  const isAll = branchId === ALL_BRANCHES;
  const pendientes = usePendingWrites(RECURSOS_DE_INVENTARIO);

  if (items.length === 0) return <EmptyState />;

  // Tarjetas en teléfono Y en tablet; la tabla aparece recién en pantallas anchas (ver TABLE_LAYOUT_QUERY).
  if (!isDesktop) {
    return (
      <div className="flex flex-col gap-2.5">
        {items.map((item) => (
          <ItemCard
            branchId={branchId}
            item={item}
            key={item.id}
            marca={pendientes.marcaDe('item', item.id)}
            onOpen={() => onOpen(item, 'actions')}
          />
        ))}
      </div>
    );
  }

  const columnas = columnasDe(isAll);
  /** Bloque de cabecera de la pizarra, con el degradado repartido entre las columnas que hay. */
  const cab = (nombre: (typeof COLUMNAS)[number]) => cabeceraDe(columnas.indexOf(nombre), columnas.length);

  return (
    <Card>
      <Card.Content>
    <Table variant="secondary">
      <Table.ScrollContainer>
        <Table.Content aria-label="Inventario" className="min-w-240">
          <Table.Header>
            <Table.Column className={cab('sku')} isRowHeader>
              SKU
            </Table.Column>
            <Table.Column className={cab('nombre')}>Nombre</Table.Column>
            <Table.Column className={cab('categoria')}>Categoría</Table.Column>
            <Table.Column className={cab('existencia')}>
              {isAll ? 'Existencia · total' : 'Existencia acá'}
            </Table.Column>
            <Table.Column className={cab('sucursal')}>Sucursal</Table.Column>
            {isAll ? null : (
              <Table.Column className={cab('minimo')}>Mínimo</Table.Column>
            )}
            <Table.Column className={cab('estado')}>Estado</Table.Column>
            <Table.Column className={cab('acciones')}>Acciones</Table.Column>
          </Table.Header>
          <Table.Body>
            {items.map((item) => (
              <ItemRow
                branchId={branchId}
                item={item}
                key={item.id}
                marca={pendientes.marcaDe('item', item.id)}
                onEdit={() => onEdit(item)}
                onOpen={(view) => onOpen(item, view)}
              />
            ))}
          </Table.Body>
        </Table.Content>
      </Table.ScrollContainer>
    </Table>
      </Card.Content>
    </Card>
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
  const { can, canAny } = usePermissions();
  const puedeDarDeBaja = can('item.setActive');

  const selectedBranchId = useUiStore((state) => state.selectedBranchId);
  const setSelectedBranchId = useUiStore((state) => state.setSelectedBranchId);

  const [tab, setTab] = useState<ItemType>('SUPPLY');
  const [search, setSearch] = useState('');
  const [categoryId, setCategoryId] = useState(ALL_CATEGORIES);
  // `?filtro=bajo-minimo` (link del KPI del dashboard) parte en «Requieren
  // atención»; se lee una sola vez al montar.
  const [searchParams] = useSearchParams();
  const [stockFilter, setStockFilter] = useState<StockFilter>(() =>
    searchParams.get('filtro') === 'bajo-minimo' ? 'atencion' : 'todos',
  );

  const [target, setTarget] = useState<RowTarget | null>(null);
  const [editItem, setEditItem] = useState<InventoryItem | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isPicking, setIsPicking] = useState(false);
  const [verDadosDeBaja, setVerDadosDeBaja] = useState(false);

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
    // Quien puede dar de baja ve también los dados de baja si lo pide (para reactivarlos).
    ...(verDadosDeBaja && puedeDarDeBaja ? {} : { isActive: true }),
    ...(search.trim() ? { q: search.trim() } : {}),
    ...(categoryId === ALL_CATEGORIES ? {} : { categoryId }),
  });

  const all = useMemo(() => data ?? [], [data]);

  const alertCount = useMemo(
    () => all.filter((item) => stockStatus(item, branchId).tone !== 'ok').length,
    [all, branchId],
  );

  // Los críticos van arriba (pedido del cliente): son los que no pueden faltar.
  // Orden estable: dentro de cada grupo se mantiene el orden del servidor.
  const items = useMemo(() => {
    const filtrados =
      stockFilter === 'atencion'
        ? all.filter((item) => stockStatus(item, branchId).tone !== 'ok')
        : all;
    return [...filtrados].sort((a, b) => Number(b.isCritical) - Number(a.isCritical));
  }, [all, stockFilter, branchId]);

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
          className="inline-flex h-12 items-center gap-2 rounded-(--field-radius) border border-border bg-card px-4 text-sm font-semibold text-foreground hover:bg-[var(--surface-secondary)]"
          to="/inventario/movimientos"
        >
          <History size={16} />
          Historial general
        </Link>
        {canAny(MOVEMENT_ACTIONS) ? (
          <Button onPress={() => setIsPicking(true)} variant="secondary">
            Registrar movimiento
          </Button>
        ) : null}
        {can('category.create') ? <CategoriesModal /> : null}
        {can('item.create') ? (
          <Button onPress={() => setIsCreating(true)}>Nuevo ítem</Button>
        ) : null}
      </div>

      <PendientesStrip recursos={RECURSOS_DE_INVENTARIO} />

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

      {/* Los cuatro filtros con el mismo esquema (label afuera + control de
          48px) para que en escritorio queden en una sola fila nivelada; el
          switch de dados de baja va aparte, debajo, porque no es un filtro
          del mismo tipo y desarmaba la grilla. */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_auto_auto]">
        <TextField
          aria-label="Buscar ítem"
          className="label-outside"
          onChange={setSearch}
          value={search}
        >
          <Label>Buscar</Label>
          <Input placeholder="SKU, nombre o nº de parte" />
        </TextField>

        <Select
          className="label-outside"
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

        <div className="flex flex-col gap-1">
          <span className="label">Sucursal</span>
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

        <div className="flex flex-col gap-1">
          <span className="label">Estado</span>
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

      {puedeDarDeBaja ? (
        <Switch isSelected={verDadosDeBaja} onChange={setVerDadosDeBaja}>
          <Switch.Content>
            <Switch.Control>
              <Switch.Thumb />
            </Switch.Control>
            Mostrar dados de baja
          </Switch.Content>
        </Switch>
      ) : null}

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
          initialView={target.view}
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
          branches={branches ?? []}
          defaultType={tab}
          isOpen
          onOpenChange={setIsCreating}
        />
      ) : null}
    </div>
  );
}
