import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Button,
  Chip,
  Input,
  Label,
  ListBox,
  Select,
  Spinner,
  Table,
  TextField,
} from '@heroui/react';

import { CategoriesModal } from '../components/inventario/CategoriesModal';
import { ItemActionsModal } from '../components/inventario/ItemActionsModal';
import { ItemCard } from '../components/inventario/ItemCard';
import {
  EditItemModal,
  NewItemModal,
} from '../components/inventario/ItemFormModal';
import {
  AVAILABILITY_COLORS,
  NUMBER,
  Segmented,
  availability,
  elsewhereLabel,
} from '../components/inventario/shared';
import { useBranches } from '../hooks/useBranches';
import { useCategories } from '../hooks/useCategories';
import { useCurrentUser } from '../hooks/useCurrentUser';
import { useEquipment } from '../hooks/useEquipment';
import { useCreateMovement, useItems } from '../hooks/useInventory';
import { DESKTOP_QUERY, useMediaQuery } from '../hooks/useMediaQuery';
import { useUiStore } from '../store/ui';
import { ROLES } from '../types/roles';
import type { Branch } from '../types/branch';
import {
  UNIT_SYMBOLS,
  isBelowMinimumAt,
  quantityAt,
  stockAt,
  totalQuantity,
  type InventoryItem,
  type ItemType,
  type MovementDirection,
} from '../types/inventory';

/** Centinela del filtro: "todas" no es un id de categoría. */
const ALL_CATEGORIES = '__all__';

type StockFilter = 'todos' | 'bajo';

// --- Fila de escritorio ----------------------------------------------------

/**
 * La tabla es solo para pantallas anchas. Debajo de `lg` la misma información
 * se muestra en tarjetas (`ItemCard`) — es lo que dibujan los tres artboards
 * del equipo: tarjetas en teléfono Y en tablet, tabla recién en PC.
 */
function ItemRow({
  item,
  branchId,
  canWrite,
  canIssue,
  onOpen,
}: {
  item: InventoryItem;
  branchId: string;
  canWrite: boolean;
  canIssue: boolean;
  onOpen: () => void;
}) {
  const [amount, setAmount] = useState('');
  const createMovement = useCreateMovement();

  const here = quantityAt(item, branchId);
  const minimum = stockAt(item, branchId)?.minimumQuantity ?? 0;
  const state = availability(here, totalQuantity(item));
  const belowMinimum = isBelowMinimumAt(item, branchId);

  const quantity = Number(amount);
  const validAmount = Number.isFinite(quantity) && quantity > 0;

  function move(direction: MovementDirection): void {
    if (!validAmount) return;
    createMovement.mutate(
      {
        input: {
          itemId: item.id,
          branchId,
          // El motivo no se adivina: es el que dice el botón. Entrar material
          // es una recepción; sacarlo donde hay equipos es consumo de
          // mantención. Los demás motivos se eligen en «Registrar movimiento».
          reason: direction === 'IN' ? 'PURCHASE' : 'INTERVENTION',
          direction,
          quantity,
        },
        item,
      },
      { onSuccess: () => setAmount('') },
    );
  }

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
            {/* Su falta detiene la máquina: se marca aunque el saldo todavía
                no cruce el mínimo. */}
            {item.isCritical ? (
              <Chip color="danger" size="sm" variant="soft">
                Crítico
              </Chip>
            ) : null}
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
          belowMinimum ? 'font-semibold text-danger' : 'text-foreground'
        }`}
      >
        {NUMBER.format(here)} {UNIT_SYMBOLS[item.unit]}
      </Table.Cell>
      <Table.Cell className="font-mono text-sm text-muted-foreground">
        {NUMBER.format(totalQuantity(item))}
      </Table.Cell>
      <Table.Cell className="font-mono text-sm text-muted-foreground">
        {minimum > 0 ? NUMBER.format(minimum) : '—'}
      </Table.Cell>
      <Table.Cell>
        <div className="flex flex-wrap items-center gap-1.5">
          <Chip color={AVAILABILITY_COLORS[state]} size="sm" variant="soft">
            {state === 'en-bodega'
              ? 'En esta bodega'
              : elsewhereLabel(item, branchId)}
          </Chip>
          {/* Reponer y no tener son cosas distintas: el ítem puede estar
              disponible hoy y aun así haber cruzado el mínimo de la bodega.
              Va en rojo porque es lo único de la fila que exige una acción. */}
          {state === 'en-bodega' && belowMinimum ? (
            <Chip color="danger" size="sm" variant="soft">
              Bajo mínimo
            </Chip>
          ) : null}
        </div>
      </Table.Cell>
      <Table.Cell>
        {/* El atajo del escritorio: el bodeguero frente al PC escribe una
            cantidad y aprieta dos veces. Todo lo demás — motivo distinto,
            traspaso, mínimo, conteo, ficha — vive en «Acciones», que es el
            mismo panel que se abre en teléfono. */}
        <div className="flex flex-wrap items-center justify-end gap-2">
          {canWrite ? (
            <>
              <input
                aria-label={`Cantidad para ${item.sku}`}
                className="h-8 w-16 rounded-md border border-border bg-transparent px-2 text-right font-mono text-sm text-foreground"
                inputMode="decimal"
                onChange={(event) => setAmount(event.target.value)}
                placeholder="0"
                value={amount}
              />
              <Button
                aria-label={`Registrar recepción de ${item.sku}`}
                isDisabled={!validAmount || createMovement.isPending}
                onPress={() => move('IN')}
                size="sm"
                variant="secondary"
              >
                +
              </Button>
              <Button
                aria-label={`Registrar consumo de ${item.sku}`}
                isDisabled={
                  !canIssue || !validAmount || createMovement.isPending
                }
                onPress={() => move('OUT')}
                size="sm"
                variant="secondary"
              >
                −
              </Button>
            </>
          ) : null}
          <Button onPress={onOpen} size="sm" variant="secondary">
            {canWrite ? 'Acciones' : 'Ver'}
          </Button>
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
  canIssue,
  onOpen,
}: {
  items: InventoryItem[];
  branchId: string;
  canWrite: boolean;
  canIssue: boolean;
  onOpen: (item: InventoryItem) => void;
}) {
  const isDesktop = useMediaQuery(DESKTOP_QUERY);

  if (items.length === 0) return <EmptyState />;

  // Tarjetas en teléfono Y en tablet; la tabla aparece recién en escritorio.
  // Es el corte que dibujan los tres artboards del equipo: a 834 px de ancho
  // una tabla de ocho columnas todavía obliga a desplazarse en horizontal para
  // leer una fila.
  if (!isDesktop) {
    return (
      <div className="flex flex-col gap-2.5">
        {items.map((item) => (
          <ItemCard
            branchId={branchId}
            item={item}
            key={item.id}
            onOpen={() => onOpen(item)}
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
            <Table.Column isRowHeader>SKU</Table.Column>
            <Table.Column>Nombre</Table.Column>
            <Table.Column>Categoría</Table.Column>
            <Table.Column>Stock acá</Table.Column>
            <Table.Column>Total empresa</Table.Column>
            <Table.Column>Mínimo</Table.Column>
            <Table.Column>Estado</Table.Column>
            <Table.Column>Acciones</Table.Column>
          </Table.Header>
          <Table.Body>
            {items.map((item) => (
              <ItemRow
                branchId={branchId}
                canIssue={canIssue}
                canWrite={canWrite}
                item={item}
                key={item.id}
                onOpen={() => onOpen(item)}
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

  const [openItem, setOpenItem] = useState<InventoryItem | null>(null);
  const [editItem, setEditItem] = useState<InventoryItem | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  const { data: branches } = useBranches({ isActive: true });
  const { data: categories } = useCategories();

  // La primera sucursal se elige una sola vez, cuando llega la lista. Cuando
  // T12 suba el selector al layout, esto se va y la vista solo lee del store.
  useEffect(() => {
    if (selectedBranchId || !branches || branches.length === 0) return;
    setSelectedBranchId(branches[0].id);
  }, [branches, selectedBranchId, setSelectedBranchId]);

  const branchId = selectedBranchId ?? '';
  const branchName =
    branches?.find((branch) => branch.id === branchId)?.name ?? '';

  const { data, isPending, isError, error } = useItems({
    type: tab,
    isActive: true,
    ...(search.trim() ? { q: search.trim() } : {}),
    ...(categoryId === ALL_CATEGORIES ? {} : { categoryId }),
  });

  const all = useMemo(() => data ?? [], [data]);

  const belowMinimumCount = useMemo(
    () => all.filter((item) => isBelowMinimumAt(item, branchId)).length,
    [all, branchId],
  );

  const items = useMemo(
    () =>
      stockFilter === 'bajo'
        ? all.filter((item) => isBelowMinimumAt(item, branchId))
        : all,
    [all, stockFilter, branchId],
  );

  // El consumo se registra donde operan las máquinas. Se deriva de si la
  // bodega tiene equipos asignados (`Equipment.homeBranch`) en vez de comparar
  // el nombre contra "Faena": el modelo todavía no tiene un campo que diga qué
  // sucursal es operativa — está propuesto como `Branch.isOperational`.
  const { data: branchEquipment } = useEquipment(
    branchId ? { homeBranchId: branchId } : {},
  );
  const canIssue = canWrite && (branchEquipment?.length ?? 0) > 0;

  // La ficha se abre desde el panel de acciones: se cierra uno y se abre el
  // otro para no apilar dos modales.
  const openEdit = (item: InventoryItem): void => {
    setOpenItem(null);
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
            Existencias de suministros y repuestos en{' '}
            <strong className="font-semibold text-foreground">
              {branchName}
            </strong>
            , con su mínimo de reposición y el movimiento de cada salida.
          </p>
        </div>
        {isAdmin && branchId ? (
          <div className="hidden items-center gap-2 sm:flex">
            <CategoriesModal />
            <Button onPress={() => setIsCreating(true)}>Nuevo ítem</Button>
          </div>
        ) : null}
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

      {/* Filtros. En teléfono se apilan a ancho completo; desde `sm` van en
          fila. El selector de sucursal vive acá hasta que T12 lo suba a la
          barra superior del layout, que es donde lo pone el diseño. */}
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

        <TextField
          aria-label="Buscar ítem"
          onChange={setSearch}
          value={search}
        >
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

        {/* Con el conteo en la propia pestaña no hace falta un chip aparte
            diciendo cuántos hay bajo el mínimo: el filtro ya lo dice. */}
        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-(--label-color)">
            Existencias
          </span>
          <Segmented
            label="Filtro de existencias"
            onChange={setStockFilter}
            options={[
              { id: 'todos', label: `Todos · ${all.length}` },
              { id: 'bajo', label: `Bajo mínimo · ${belowMinimumCount}` },
            ]}
            value={stockFilter}
          />
        </div>
      </div>

      {/* En teléfono los botones de cabecera se van al final de los filtros,
          a ancho completo: arriba compiten con el título y quedan chicos. */}
      {isAdmin && branchId ? (
        <div className="flex gap-2 sm:hidden">
          <CategoriesModal />
          <Button className="flex-1" onPress={() => setIsCreating(true)}>
            Nuevo ítem
          </Button>
        </div>
      ) : null}

      {canWrite && branchId && !canIssue ? (
        <Chip size="sm" variant="soft">
          {branchName} no tiene equipos asignados: solo recibe material
        </Chip>
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
          canIssue={canIssue}
          canWrite={canWrite}
          items={items}
          onOpen={setOpenItem}
        />
      )}

      {openItem ? (
        <ItemActionsModal
          branchId={branchId}
          branchName={branchName}
          branches={branches ?? []}
          canIssue={canIssue}
          canWrite={canWrite}
          isAdmin={isAdmin}
          isOpen
          item={openItem}
          onEdit={() => openEdit(openItem)}
          onOpenChange={(open) => !open && setOpenItem(null)}
        />
      ) : null}

      {editItem ? (
        <EditItemModal
          isOpen
          item={editItem}
          onOpenChange={(open) => !open && setEditItem(null)}
        />
      ) : null}

      {isCreating ? (
        <NewItemModal
          branchId={branchId}
          branchName={branchName}
          defaultType={tab}
          isOpen
          onOpenChange={setIsCreating}
        />
      ) : null}
    </div>
  );
}
