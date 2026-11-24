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
import { ItemEquipmentsCell } from '../components/inventario/ItemEquipments';
import { Chip } from '../components/ui/Chip';
import { SortControl } from '../components/ui/SortControl';
import { sortableHeader } from '../components/ui/SortableHeader';
import { CEBRA_COLUMNAS, cabeceraDe, fondoColumna } from '../components/ui/tabla-pizarra';
import { useBranches } from '../hooks/useBranches';
import { useEquipment } from '../hooks/useEquipment';
import { usePermissions } from '../hooks/usePermissions';
import {
  defaultInventoryOrder,
  inventorySortColumns,
  inventorySortOptions,
} from '../lib/inventory-sort';
import { MOVEMENT_ACTIONS } from '../lib/permissions';
import { sortRows, type TableSort } from '../lib/table-sort';
import { MarcaPendiente } from '../components/sync/MarcaPendiente';
import { PendientesStrip } from '../components/sync/PendientesStrip';
import { useItems } from '../hooks/useInventory';
import { usePendingWrites, type MarcaPendiente as Marca } from '../hooks/usePendingWrites';
import { TABLE_LAYOUT_QUERY, useMediaQuery } from '../hooks/useMediaQuery';
import { RECURSOS_DE_INVENTARIO } from '../lib/pending-resources';
import { useUiStore } from '../store/ui';
import type { Branch } from '../types/branch';
import {
  ITEM_TYPE_LABELS,
  UNIT_SYMBOLS,
  quantityAt,
  stockAt,
  totalQuantity,
  type InventoryItem,
  type ItemType,
} from '../types/inventory';

/** Centinela del filtro de categoría: "todas" no es un id. */
const ALL_CATEGORIES = '__all__';
/** Pastilla «Sin categoría»: los ítems que no tienen una. */
const NO_CATEGORY = '__none__';
/** Centinela del filtro de equipo. */
const ALL_EQUIPMENTS = '__all__';

type TypeFilter = 'todos' | ItemType;

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
          className="font-mono text-sm font-medium whitespace-nowrap text-(--accent) hover:underline"
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
      <Table.Cell {...col('tipo')}>
        <Chip color={item.type === 'PART' ? 'accent' : 'default'} size="sm" variant="soft">
          {ITEM_TYPE_LABELS[item.type]}
        </Chip>
      </Table.Cell>
      <Table.Cell className="text-sm text-muted-foreground" {...col('categoria')}>
        {item.category?.name ?? 'Sin categoría'}
      </Table.Cell>
      <Table.Cell {...col('equipos')}>
        <ItemEquipmentsCell equipments={item.compatibilities} />
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

/** Título ordenable sobre la cabecera de color: la columna activa va subrayada (el acento no se lee sobre el azul). */
const cabeceraOrdenable = (titulo: string) => sortableHeader(titulo, 'underline underline-offset-4');

/** Columnas de la tabla en orden; «Mínimo» solo con una sucursal elegida. */
const COLUMNAS = [
  'sku',
  'nombre',
  'tipo',
  'categoria',
  'equipos',
  'existencia',
  'sucursal',
  'minimo',
  'estado',
  'acciones',
] as const;

const columnasDe = (isAll: boolean): readonly (typeof COLUMNAS)[number][] =>
  isAll ? COLUMNAS.filter((c) => c !== 'minimo') : COLUMNAS;

function ItemsList({
  items,
  branchId,
  orden,
  onOrdenChange,
  onOpen,
  onEdit,
}: {
  items: InventoryItem[];
  branchId: string;
  /** `null` = el orden por defecto (críticos primero, luego por nombre). */
  orden: TableSort | null;
  onOrdenChange: (orden: TableSort) => void;
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
      <div>
        <SortControl
          onChange={onOrdenChange}
          options={inventorySortOptions(branchId)}
          sort={orden ?? { column: 'nombre', direction: 'ascending' }}
        />
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
        <Table.Content
          aria-label="Inventario"
          className="min-w-280"
          onSortChange={(d) => onOrdenChange({ column: d.column, direction: d.direction })}
          sortDescriptor={orden ?? undefined}
        >
          <Table.Header>
            <Table.Column allowsSorting className={cab('sku')} id="sku" isRowHeader>
              {cabeceraOrdenable('SKU')}
            </Table.Column>
            <Table.Column allowsSorting className={cab('nombre')} id="nombre">
              {cabeceraOrdenable('Nombre')}
            </Table.Column>
            <Table.Column allowsSorting className={cab('tipo')} id="tipo">
              {cabeceraOrdenable('Tipo')}
            </Table.Column>
            <Table.Column allowsSorting className={cab('categoria')} id="categoria">
              {cabeceraOrdenable('Categoría')}
            </Table.Column>
            <Table.Column allowsSorting className={cab('equipos')} id="equipos">
              {cabeceraOrdenable('Equipos')}
            </Table.Column>
            <Table.Column allowsSorting className={cab('existencia')} id="existencia">
              {cabeceraOrdenable(isAll ? 'Existencia · total' : 'Existencia acá')}
            </Table.Column>
            <Table.Column allowsSorting className={cab('sucursal')} id="sucursal">
              {cabeceraOrdenable('Sucursal')}
            </Table.Column>
            {isAll ? null : (
              <Table.Column allowsSorting className={cab('minimo')} id="minimo">
                {cabeceraOrdenable('Mínimo')}
              </Table.Column>
            )}
            <Table.Column allowsSorting className={cab('estado')} id="estado">
              {cabeceraOrdenable('Estado')}
            </Table.Column>
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

/** Pastilla de categoría con su conteo: se elige con un toque, sin abrir un select. */
function CategoryPill({
  label,
  count,
  isSelected,
  onPress,
}: {
  label: string;
  count: number;
  isSelected: boolean;
  onPress: () => void;
}) {
  return (
    <button
      aria-pressed={isSelected}
      className={`inline-flex h-10 shrink-0 cursor-pointer items-center gap-1.5 rounded-full border px-3.5 text-sm font-semibold whitespace-nowrap transition-colors ${
        isSelected
          ? 'border-transparent bg-(--accent) text-(--accent-foreground)'
          : 'border-border bg-card text-foreground hover:bg-[var(--surface-secondary)]'
      }`}
      onClick={onPress}
      type="button"
    >
      {label}
      <span className={`font-mono text-xs ${isSelected ? 'opacity-80' : 'text-muted-foreground'}`}>{count}</span>
    </button>
  );
}

export function InventarioView() {
  const { can, canAny } = usePermissions();
  const puedeDarDeBaja = can('item.setActive');

  const selectedBranchId = useUiStore((state) => state.selectedBranchId);
  const setSelectedBranchId = useUiStore((state) => state.setSelectedBranchId);

  const [typeFilter, setTypeFilter] = useState<TypeFilter>('todos');
  const [search, setSearch] = useState('');
  const [categoryId, setCategoryId] = useState(ALL_CATEGORIES);
  const [equipmentId, setEquipmentId] = useState(ALL_EQUIPMENTS);
  // `null` = el orden por defecto de la lista (críticos primero, luego por nombre).
  const [orden, setOrden] = useState<TableSort | null>(null);
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
  const { data: equipments } = useEquipment();

  /**
   * El inventario **general** es lo que se ve primero: con dos faenas, la
   * pregunta de partida es "¿cuánto hay en la empresa?", y recién después "¿en
   * cuál?". Elegir una sucursal es un filtro, no el punto de entrada.
   */
  const branchId = selectedBranchId ?? ALL_BRANCHES;

  // Sin pestañas: llegan TODOS los ítems y el tipo y la categoría se filtran acá,
  // para que las pastillas de categoría puedan mostrar su conteo sin otra consulta.
  const { data, isPending, isError, error } = useItems({
    // Quien puede dar de baja ve también los dados de baja si lo pide (para reactivarlos).
    ...(verDadosDeBaja && puedeDarDeBaja ? {} : { isActive: true }),
    ...(search.trim() ? { q: search.trim() } : {}),
    ...(equipmentId === ALL_EQUIPMENTS ? {} : { equipmentId }),
  });

  const allItems = useMemo(() => data ?? [], [data]);
  // Lo que el tipo deja a la vista: sobre eso se cuentan estado y categorías.
  const all = useMemo(
    () => (typeFilter === 'todos' ? allItems : allItems.filter((item) => item.type === typeFilter)),
    [allItems, typeFilter],
  );

  const alertCount = useMemo(
    () => all.filter((item) => stockStatus(item, branchId).tone !== 'ok').length,
    [all, branchId],
  );

  const scoped = useMemo(
    () => (stockFilter === 'atencion' ? all.filter((item) => stockStatus(item, branchId).tone !== 'ok') : all),
    [all, stockFilter, branchId],
  );

  // Las pastillas salen de los ítems a la vista (con su conteo): solo aparecen
  // categorías que tienen algo, y el número coincide con lo que se vería al tocarlas.
  const categoryPills = useMemo(() => {
    const counts = new Map<string, { id: string; name: string; count: number }>();
    let uncategorized = 0;
    for (const item of scoped) {
      if (!item.category) {
        uncategorized += 1;
        continue;
      }
      const current = counts.get(item.category.id);
      if (current) current.count += 1;
      else counts.set(item.category.id, { id: item.category.id, name: item.category.name, count: 1 });
    }
    const pills = [...counts.values()].sort((a, b) => a.name.localeCompare(b.name, 'es-CL'));
    return uncategorized > 0 ? [...pills, { id: NO_CATEGORY, name: 'Sin categoría', count: uncategorized }] : pills;
  }, [scoped]);

  // Si la categoría elegida ya no tiene ítems (cambió otro filtro), se vuelve a «Todas».
  const activeCategory = categoryPills.some((pill) => pill.id === categoryId) ? categoryId : ALL_CATEGORIES;

  const items = useMemo(() => {
    const filtrados =
      activeCategory === ALL_CATEGORIES
        ? scoped
        : scoped.filter((item) => (activeCategory === NO_CATEGORY ? !item.category : item.category?.id === activeCategory));
    // Sin orden elegido: los críticos arriba (pedido del cliente), son los que no
    // pueden faltar; dentro de cada grupo se mantiene el orden del servidor.
    return orden
      ? sortRows(filtrados, orden, inventorySortColumns(branchId))
      : defaultInventoryOrder(filtrados);
  }, [scoped, activeCategory, orden, branchId]);

  const equipmentOptions = useMemo(
    () =>
      [...(equipments ?? [])].sort((a, b) => a.internalCode.localeCompare(b.internalCode, 'es-CL', { numeric: true })),
    [equipments],
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

      {/* Los filtros con el mismo esquema (label afuera + control de
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
            if (value) setEquipmentId(String(value));
          }}
          value={equipmentId}
        >
          <Label>Equipo</Label>
          <Select.Trigger>
            <Select.Value />
            <Select.Indicator />
          </Select.Trigger>
          <Select.Popover>
            <ListBox>
              <ListBox.Item id={ALL_EQUIPMENTS} textValue="Todos">
                Todos
                <ListBox.ItemIndicator />
              </ListBox.Item>
              {equipmentOptions.map((equipment) => (
                <ListBox.Item
                  id={equipment.id}
                  key={equipment.id}
                  textValue={`${equipment.internalCode} ${equipment.licensePlate ?? ''}`}
                >
                  {equipment.internalCode}
                  {equipment.licensePlate ? ` · ${equipment.licensePlate}` : ''}
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

      {/* Segunda fila: el tipo (compacto) y las categorías a la vista, sin abrir un
          desplegable. En celular las pastillas corren en horizontal. */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start">
        <div className="flex flex-col gap-1">
          <span className="label">Tipo</span>
          <Segmented<TypeFilter>
            label="Filtro de tipo"
            onChange={setTypeFilter}
            options={[
              { id: 'todos', label: 'Todos' },
              { id: 'SUPPLY', label: 'Suministros' },
              { id: 'PART', label: 'Repuestos' },
            ]}
            value={typeFilter}
          />
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="label">Categoría</span>
          <div
            aria-label="Filtro de categoría"
            className="-mx-1 flex min-h-12 items-center gap-2 overflow-x-auto px-1 pb-1 lg:flex-wrap lg:overflow-visible lg:pb-0"
            role="group"
          >
            <CategoryPill
              count={scoped.length}
              isSelected={activeCategory === ALL_CATEGORIES}
              label="Todas"
              onPress={() => setCategoryId(ALL_CATEGORIES)}
            />
            {categoryPills.map((pill) => (
              <CategoryPill
                count={pill.count}
                isSelected={activeCategory === pill.id}
                key={pill.id}
                label={pill.name}
                onPress={() => setCategoryId(pill.id)}
              />
            ))}
          </div>
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
          onOrdenChange={setOrden}
          orden={orden}
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
          defaultType={typeFilter === 'todos' ? 'SUPPLY' : typeFilter}
          isOpen
          onOpenChange={setIsCreating}
        />
      ) : null}
    </div>
  );
}
