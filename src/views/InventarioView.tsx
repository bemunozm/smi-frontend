import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm } from 'react-hook-form';
import {
  AlertDialog,
  Button,
  Chip,
  FieldError,
  Input,
  Label,
  ListBox,
  Modal,
  Select,
  Spinner,
  Switch,
  Table,
  Tabs,
  TextField,
} from '@heroui/react';

import { useBranches } from '../hooks/useBranches';
import { useEquipment } from '../hooks/useEquipment';
import { useCurrentUser } from '../hooks/useCurrentUser';
import {
  useAdjustStock,
  useCreateItem,
  useCreateMovement,
  useDeleteItem,
  useItems,
  useSetMinimum,
  useTransferStock,
} from '../hooks/useInventory';
import { useUiStore } from '../store/ui';
import { ROLES } from '../types/roles';
import type { Branch } from '../types/branch';
import {
  AdjustFormSchema,
  ITEM_TYPES,
  ITEM_TYPE_LABELS,
  ItemFormSchema,
  MinimumFormSchema,
  UNITS_OF_MEASURE,
  UNIT_LABELS,
  UNIT_SYMBOLS,
  isBelowMinimumAt,
  quantityAt,
  stockAt,
  toCreateItemPayload,
  totalQuantity,
  type AdjustFormValues,
  type InventoryItem,
  type ItemFormValues,
  type ItemType,
  type MinimumFormValues,
  type MovementDirection,
} from '../types/inventory';

const NUMBER = new Intl.NumberFormat('es-CL', { maximumFractionDigits: 2 });

/**
 * Cómo se ve una fila. Son tres situaciones distintas y cada una lleva a una
 * acción distinta, por eso no se colapsan en "hay / no hay": usar lo que está
 * acá, pedir un traspaso, o comprar. La alerta de reposición va aparte: **tener
 * poco no es no tener**.
 */
type Availability = 'en-bodega' | 'en-otra' | 'sin-stock';

function availability(here: number, total: number): Availability {
  if (here > 0) return 'en-bodega';
  return total > 0 ? 'en-otra' : 'sin-stock';
}

const AVAILABILITY_COLORS: Record<Availability, 'success' | 'warning' | 'danger'> =
  {
    'en-bodega': 'success',
    'en-otra': 'warning',
    'sin-stock': 'danger',
  };

// --- Alta de ítem ----------------------------------------------------------

const EMPTY_ITEM: ItemFormValues = {
  sku: '',
  name: '',
  description: '',
  unit: 'UNIT',
  type: 'SUPPLY',
  partNumber: '',
  initialQuantity: '0',
};

function NewItemModal({
  branchId,
  branchName,
  defaultType,
}: {
  branchId: string;
  branchName: string;
  defaultType: ItemType;
}) {
  const createItem = useCreateItem();
  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ItemFormValues>({
    resolver: zodResolver(ItemFormSchema),
    defaultValues: { ...EMPTY_ITEM, type: defaultType },
  });

  return (
    <Modal>
      <Button>Nuevo ítem</Button>
      <Modal.Backdrop>
        <Modal.Container>
          <Modal.Dialog className="sm:max-w-lg">
            {({ close }) => {
              const onSubmit = (values: ItemFormValues): void => {
                createItem.mutate(toCreateItemPayload(values, branchId), {
                  onSuccess: () => {
                    reset({ ...EMPTY_ITEM, type: defaultType });
                    close();
                  },
                });
              };

              return (
                <>
                  <Modal.CloseTrigger />
                  <Modal.Header>
                    <Modal.Heading className="font-display text-xl font-semibold tracking-[-0.02em]">
                      Nuevo ítem
                    </Modal.Heading>
                  </Modal.Header>
                  <Modal.Body>
                    <form
                      className="flex flex-col gap-4"
                      id="new-item-form"
                      noValidate
                      onSubmit={(event) => void handleSubmit(onSubmit)(event)}
                    >
                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <Controller
                          control={control}
                          name="sku"
                          render={({ field }) => (
                            <TextField
                              fullWidth
                              isInvalid={!!errors.sku}
                              name={field.name}
                              onBlur={field.onBlur}
                              onChange={field.onChange}
                              value={field.value}
                            >
                              <Label>SKU</Label>
                              <Input autoFocus placeholder="FIL-001" />
                              {errors.sku ? (
                                <FieldError>{errors.sku.message}</FieldError>
                              ) : null}
                            </TextField>
                          )}
                        />

                        <Controller
                          control={control}
                          name="partNumber"
                          render={({ field }) => (
                            <TextField
                              fullWidth
                              name={field.name}
                              onBlur={field.onBlur}
                              onChange={field.onChange}
                              value={field.value}
                            >
                              <Label>Nº de parte (opcional)</Label>
                              <Input placeholder="1R-0750" />
                            </TextField>
                          )}
                        />
                      </div>

                      <Controller
                        control={control}
                        name="name"
                        render={({ field }) => (
                          <TextField
                            fullWidth
                            isInvalid={!!errors.name}
                            name={field.name}
                            onBlur={field.onBlur}
                            onChange={field.onChange}
                            value={field.value}
                          >
                            <Label>Nombre</Label>
                            <Input placeholder="Filtro de aceite motor" />
                            {errors.name ? (
                              <FieldError>{errors.name.message}</FieldError>
                            ) : null}
                          </TextField>
                        )}
                      />

                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <Controller
                          control={control}
                          name="type"
                          render={({ field }) => (
                            <Select
                              fullWidth
                              name={field.name}
                              value={field.value}
                              onChange={(value) => {
                                if (value) field.onChange(value);
                              }}
                            >
                              <Label>Clasificación</Label>
                              <Select.Trigger>
                                <Select.Value />
                                <Select.Indicator />
                              </Select.Trigger>
                              <Select.Popover>
                                <ListBox>
                                  {ITEM_TYPES.map((type) => (
                                    <ListBox.Item
                                      key={type}
                                      id={type}
                                      textValue={ITEM_TYPE_LABELS[type]}
                                    >
                                      {ITEM_TYPE_LABELS[type]}
                                      <ListBox.ItemIndicator />
                                    </ListBox.Item>
                                  ))}
                                </ListBox>
                              </Select.Popover>
                            </Select>
                          )}
                        />

                        <Controller
                          control={control}
                          name="unit"
                          render={({ field }) => (
                            <Select
                              fullWidth
                              name={field.name}
                              value={field.value}
                              onChange={(value) => {
                                if (value) field.onChange(value);
                              }}
                            >
                              <Label>Unidad</Label>
                              <Select.Trigger>
                                <Select.Value />
                                <Select.Indicator />
                              </Select.Trigger>
                              <Select.Popover>
                                <ListBox>
                                  {UNITS_OF_MEASURE.map((unit) => (
                                    <ListBox.Item
                                      key={unit}
                                      id={unit}
                                      textValue={UNIT_LABELS[unit]}
                                    >
                                      {UNIT_LABELS[unit]}
                                      <ListBox.ItemIndicator />
                                    </ListBox.Item>
                                  ))}
                                </ListBox>
                              </Select.Popover>
                            </Select>
                          )}
                        />
                      </div>

                      <Controller
                        control={control}
                        name="initialQuantity"
                        render={({ field }) => (
                          <TextField
                            fullWidth
                            isInvalid={!!errors.initialQuantity}
                            name={field.name}
                            onBlur={field.onBlur}
                            onChange={field.onChange}
                            value={field.value}
                          >
                            <Label>Existencia inicial en {branchName}</Label>
                            <Input inputMode="decimal" placeholder="0" />
                            {errors.initialQuantity ? (
                              <FieldError>
                                {errors.initialQuantity.message}
                              </FieldError>
                            ) : null}
                          </TextField>
                        )}
                      />

                      <p className="text-xs text-muted-foreground">
                        La existencia inicial queda registrada como una entrada por
                        compra en {branchName}: el kardex parte explicando de dónde
                        salió el saldo. El mínimo se fija después, con la acción
                        «Mínimo» de la fila.
                      </p>
                    </form>
                  </Modal.Body>
                  <Modal.Footer>
                    <Button variant="secondary" onPress={close}>
                      Cancelar
                    </Button>
                    <Button
                      form="new-item-form"
                      isPending={createItem.isPending}
                      type="submit"
                    >
                      {({ isPending }) =>
                        isPending ? <Spinner color="current" size="sm" /> : 'Crear'
                      }
                    </Button>
                  </Modal.Footer>
                </>
              );
            }}
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}

// --- Traspaso --------------------------------------------------------------

/**
 * Pide solo el destino: la cantidad viene del campo de la fila, que es el mismo
 * que gobierna `+` y `−`. Un solo lugar donde escribir cuánto.
 */
function TransferModal({
  item,
  branchId,
  branches,
  quantity,
  isOpen,
  onOpenChange,
}: {
  item: InventoryItem;
  branchId: string;
  branches: Branch[];
  quantity: number;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const transfer = useTransferStock();
  const others = branches.filter((branch) => branch.id !== branchId);
  const [destination, setDestination] = useState(others[0]?.id ?? '');
  const here = quantityAt(item, branchId);

  return (
    <Modal.Backdrop isOpen={isOpen} onOpenChange={onOpenChange}>
      <Modal.Container>
        <Modal.Dialog className="sm:max-w-md">
          {({ close }) => (
            <>
              <Modal.CloseTrigger />
              <Modal.Header>
                <Modal.Heading className="font-display text-xl font-semibold tracking-[-0.02em]">
                  Traspasar · {item.sku}
                </Modal.Heading>
              </Modal.Header>
              <Modal.Body>
                <div className="flex flex-col gap-4">
                  <p className="text-sm text-muted-foreground">
                    Mover <strong>{NUMBER.format(quantity)} {UNIT_SYMBOLS[item.unit]}</strong>{' '}
                    de {item.name}. Quedan {NUMBER.format(here)}{' '}
                    {UNIT_SYMBOLS[item.unit]} en esta bodega.
                  </p>

                  <Select
                    fullWidth
                    value={destination}
                    onChange={(value) => {
                      if (value) setDestination(String(value));
                    }}
                  >
                    <Label>Bodega de destino</Label>
                    <Select.Trigger>
                      <Select.Value />
                      <Select.Indicator />
                    </Select.Trigger>
                    <Select.Popover>
                      <ListBox>
                        {others.map((branch) => (
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
                </div>
              </Modal.Body>
              <Modal.Footer>
                <Button variant="secondary" onPress={close}>
                  Cancelar
                </Button>
                <Button
                  isDisabled={!destination || quantity <= 0}
                  isPending={transfer.isPending}
                  onPress={() =>
                    transfer.mutate(
                      {
                        itemId: item.id,
                        sourceBranchId: branchId,
                        destinationBranchId: destination,
                        quantity,
                      },
                      { onSuccess: () => close() },
                    )
                  }
                >
                  {({ isPending }) =>
                    isPending ? <Spinner color="current" size="sm" /> : 'Traspasar'
                  }
                </Button>
              </Modal.Footer>
            </>
          )}
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}

// --- Mínimo de la bodega ---------------------------------------------------

function MinimumModal({
  item,
  branchId,
  branchName,
  isOpen,
  onOpenChange,
}: {
  item: InventoryItem;
  branchId: string;
  branchName: string;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const setMinimum = useSetMinimum();
  const current = stockAt(item, branchId)?.minimumQuantity ?? 0;
  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<MinimumFormValues>({
    resolver: zodResolver(MinimumFormSchema),
    values: { minimumQuantity: String(current) },
  });

  return (
    <Modal.Backdrop isOpen={isOpen} onOpenChange={onOpenChange}>
      <Modal.Container>
        <Modal.Dialog className="sm:max-w-md">
          {({ close }) => {
            const onSubmit = (values: MinimumFormValues): void => {
              setMinimum.mutate(
                {
                  itemId: item.id,
                  branchId,
                  minimumQuantity: Number(values.minimumQuantity),
                },
                { onSuccess: () => close() },
              );
            };

            return (
              <>
                <Modal.CloseTrigger />
                <Modal.Header>
                  <Modal.Heading className="font-display text-xl font-semibold tracking-[-0.02em]">
                    Mínimo en {branchName}
                  </Modal.Heading>
                </Modal.Header>
                <Modal.Body>
                  <form
                    className="flex flex-col gap-4"
                    id={`minimum-form-${item.id}`}
                    noValidate
                    onSubmit={(event) => void handleSubmit(onSubmit)(event)}
                  >
                    <p className="text-sm text-muted-foreground">
                      {item.sku} · {item.name}. Este umbral aplica solo a esta
                      bodega. En <strong>0</strong> deja de alertar.
                    </p>

                    <Controller
                      control={control}
                      name="minimumQuantity"
                      render={({ field }) => (
                        <TextField
                          fullWidth
                          isInvalid={!!errors.minimumQuantity}
                          name={field.name}
                          onBlur={field.onBlur}
                          onChange={field.onChange}
                          value={field.value}
                        >
                          <Label>
                            Stock mínimo ({UNIT_SYMBOLS[item.unit]})
                          </Label>
                          <Input autoFocus inputMode="decimal" />
                          {errors.minimumQuantity ? (
                            <FieldError>
                              {errors.minimumQuantity.message}
                            </FieldError>
                          ) : null}
                        </TextField>
                      )}
                    />
                  </form>
                </Modal.Body>
                <Modal.Footer>
                  <Button variant="secondary" onPress={close}>
                    Cancelar
                  </Button>
                  <Button
                    form={`minimum-form-${item.id}`}
                    isPending={setMinimum.isPending}
                    type="submit"
                  >
                    {({ isPending }) =>
                      isPending ? (
                        <Spinner color="current" size="sm" />
                      ) : (
                        'Guardar'
                      )
                    }
                  </Button>
                </Modal.Footer>
              </>
            );
          }}
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}

// --- Conteo físico ---------------------------------------------------------

function AdjustModal({
  item,
  branchId,
  branchName,
  isOpen,
  onOpenChange,
}: {
  item: InventoryItem;
  branchId: string;
  branchName: string;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const adjust = useAdjustStock();
  const here = quantityAt(item, branchId);
  const {
    control,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<AdjustFormValues>({
    resolver: zodResolver(AdjustFormSchema),
    values: { countedQuantity: String(here), notes: '' },
  });

  const counted = Number(watch('countedQuantity'));
  const difference = Number.isFinite(counted) ? counted - here : 0;

  return (
    <Modal.Backdrop isOpen={isOpen} onOpenChange={onOpenChange}>
      <Modal.Container>
        <Modal.Dialog className="sm:max-w-md">
          {({ close }) => {
            const onSubmit = (values: AdjustFormValues): void => {
              adjust.mutate(
                {
                  id: item.id,
                  input: {
                    branchId,
                    countedQuantity: Number(values.countedQuantity),
                    ...(values.notes.trim()
                      ? { notes: values.notes.trim() }
                      : {}),
                  },
                },
                { onSuccess: () => close() },
              );
            };

            return (
              <>
                <Modal.CloseTrigger />
                <Modal.Header>
                  <Modal.Heading className="font-display text-xl font-semibold tracking-[-0.02em]">
                    Conteo físico · {item.sku}
                  </Modal.Heading>
                </Modal.Header>
                <Modal.Body>
                  <form
                    className="flex flex-col gap-4"
                    id={`adjust-form-${item.id}`}
                    noValidate
                    onSubmit={(event) => void handleSubmit(onSubmit)(event)}
                  >
                    <p className="text-sm text-muted-foreground">
                      El sistema tiene{' '}
                      <strong>
                        {NUMBER.format(here)} {UNIT_SYMBOLS[item.unit]}
                      </strong>{' '}
                      en {branchName}. Ingresa lo que contaste y se registra la
                      diferencia.
                    </p>

                    <Controller
                      control={control}
                      name="countedQuantity"
                      render={({ field }) => (
                        <TextField
                          fullWidth
                          isInvalid={!!errors.countedQuantity}
                          name={field.name}
                          onBlur={field.onBlur}
                          onChange={field.onChange}
                          value={field.value}
                        >
                          <Label>Cantidad contada</Label>
                          <Input autoFocus inputMode="decimal" />
                          {errors.countedQuantity ? (
                            <FieldError>
                              {errors.countedQuantity.message}
                            </FieldError>
                          ) : null}
                        </TextField>
                      )}
                    />

                    {difference !== 0 ? (
                      <Chip
                        color={difference > 0 ? 'success' : 'warning'}
                        size="sm"
                        variant="soft"
                      >
                        Diferencia: {difference > 0 ? '+' : ''}
                        {NUMBER.format(difference)} {UNIT_SYMBOLS[item.unit]}
                      </Chip>
                    ) : null}
                  </form>
                </Modal.Body>
                <Modal.Footer>
                  <Button variant="secondary" onPress={close}>
                    Cancelar
                  </Button>
                  <Button
                    form={`adjust-form-${item.id}`}
                    isPending={adjust.isPending}
                    type="submit"
                  >
                    {({ isPending }) =>
                      isPending ? (
                        <Spinner color="current" size="sm" />
                      ) : (
                        'Ajustar'
                      )
                    }
                  </Button>
                </Modal.Footer>
              </>
            );
          }}
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}

// --- Baja ------------------------------------------------------------------

function DeleteItemDialog({
  item,
  isOpen,
  onOpenChange,
}: {
  item: InventoryItem;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const deleteItem = useDeleteItem();

  return (
    <AlertDialog.Backdrop isOpen={isOpen} onOpenChange={onOpenChange}>
      <AlertDialog.Container>
        <AlertDialog.Dialog className="sm:max-w-105">
          {({ close }) => (
            <>
              <AlertDialog.Header>
                <AlertDialog.Heading className="font-display text-lg font-semibold">
                  Eliminar {item.sku}
                </AlertDialog.Heading>
              </AlertDialog.Header>
              <AlertDialog.Body>
                <p className="text-sm text-muted-foreground">
                  Si el ítem ya tiene movimientos, el backend lo impide para no
                  perder su kardex y sugiere darlo de baja en su lugar.
                </p>
              </AlertDialog.Body>
              <AlertDialog.Footer>
                <Button variant="tertiary" onPress={close}>
                  Cancelar
                </Button>
                <Button
                  variant="danger"
                  isPending={deleteItem.isPending}
                  onPress={() =>
                    deleteItem.mutate(item.id, { onSuccess: () => close() })
                  }
                >
                  {({ isPending }) =>
                    isPending ? (
                      <Spinner color="current" size="sm" />
                    ) : (
                      'Eliminar'
                    )
                  }
                </Button>
              </AlertDialog.Footer>
            </>
          )}
        </AlertDialog.Dialog>
      </AlertDialog.Container>
    </AlertDialog.Backdrop>
  );
}

// --- Fila ------------------------------------------------------------------

type RowAction = 'transfer' | 'minimum' | 'adjust' | 'delete';

/**
 * Dónde está lo que falta acá. Se nombran las bodegas en vez de decir "en otra
 * sucursal": el bodeguero tiene que saber a cuál pedirle, y con dos sucursales
 * "otra" ya obliga a adivinar.
 */
function elsewhereLabel(item: InventoryItem, branchId: string): string {
  const names = item.stocks
    .filter((stock) => stock.branchId !== branchId && stock.quantity > 0)
    .map((stock) => stock.branch.name);
  if (names.length === 0) return 'Sin stock';
  return `En ${names.join(' y ')}`;
}

function ItemRow({
  item,
  branchId,
  branchName,
  branches,
  canWrite,
  canIssue,
  isAdmin,
}: {
  item: InventoryItem;
  branchId: string;
  branchName: string;
  branches: Branch[];
  canWrite: boolean;
  /** Solo las bodegas de faena consumen material. Ver `InventarioView`. */
  canIssue: boolean;
  isAdmin: boolean;
}) {
  const [action, setAction] = useState<RowAction | null>(null);
  const [amount, setAmount] = useState('');
  const createMovement = useCreateMovement();

  const here = quantityAt(item, branchId);
  const total = totalQuantity(item);
  const minimum = stockAt(item, branchId)?.minimumQuantity ?? 0;
  const state = availability(here, total);
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
          direction,
          // El motivo no se adivina: es el que dice el botón. Entrar material es
          // una recepción; sacarlo en faena es consumo de mantención. Los demás
          // motivos (devolución, trabajo extraordinario) se registran desde el
          // kardex, donde se elige explícitamente.
          reason: direction === 'IN' ? 'PURCHASE' : 'INTERVENTION',
          quantity,
        },
        item,
      },
      { onSuccess: () => setAmount('') },
    );
  }

  return (
    <>
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
            <span className="text-foreground">{item.name}</span>
            {item.partNumber ? (
              <span className="font-mono text-xs text-muted-foreground">
                {item.partNumber}
              </span>
            ) : null}
          </div>
        </Table.Cell>
        <Table.Cell className="font-mono text-sm text-foreground">
          {NUMBER.format(here)} {UNIT_SYMBOLS[item.unit]}
        </Table.Cell>
        <Table.Cell className="font-mono text-sm text-muted-foreground">
          {NUMBER.format(total)}
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
                disponible hoy y aun así haber cruzado el mínimo de la bodega. */}
            {state === 'en-bodega' && belowMinimum ? (
              <Chip color="warning" size="sm" variant="soft">
                Bajo mínimo
              </Chip>
            ) : null}
          </div>
        </Table.Cell>
        <Table.Cell>
          <div className="flex flex-wrap items-center justify-end gap-2">
            {canWrite ? (
              <>
                <input
                  aria-label={`Cantidad para ${item.sku}`}
                  className="h-8 w-16 rounded-md border border-border bg-transparent px-2 text-right font-mono text-sm text-foreground"
                  inputMode="decimal"
                  placeholder="0"
                  value={amount}
                  onChange={(event) => setAmount(event.target.value)}
                />
                <Button
                  aria-label={`Registrar recepción de ${item.sku}`}
                  isDisabled={!validAmount || createMovement.isPending}
                  size="sm"
                  variant="secondary"
                  onPress={() => move('IN')}
                >
                  +
                </Button>
                <Button
                  aria-label={`Registrar consumo de ${item.sku}`}
                  isDisabled={
                    !canIssue || !validAmount || createMovement.isPending
                  }
                  size="sm"
                  variant="secondary"
                  onPress={() => move('OUT')}
                >
                  −
                </Button>
                {branches.length > 1 ? (
                  <button
                    className="text-sm text-(--accent) hover:underline disabled:text-muted-foreground disabled:no-underline"
                    disabled={!validAmount}
                    type="button"
                    onClick={() => setAction('transfer')}
                  >
                    Traspasar
                  </button>
                ) : null}
                <button
                  className="text-sm text-muted-foreground hover:underline"
                  type="button"
                  onClick={() => setAction('minimum')}
                >
                  Mínimo
                </button>
              </>
            ) : null}
            {isAdmin ? (
              <>
                <button
                  className="text-sm text-muted-foreground hover:underline"
                  type="button"
                  onClick={() => setAction('adjust')}
                >
                  Conteo
                </button>
                <button
                  className="text-sm text-danger hover:underline"
                  type="button"
                  onClick={() => setAction('delete')}
                >
                  Eliminar
                </button>
              </>
            ) : null}
          </div>
        </Table.Cell>
      </Table.Row>

      {action === 'transfer' ? (
        <TransferModal
          branchId={branchId}
          branches={branches}
          isOpen
          item={item}
          quantity={quantity}
          onOpenChange={(open) => !open && setAction(null)}
        />
      ) : null}
      {action === 'minimum' ? (
        <MinimumModal
          branchId={branchId}
          branchName={branchName}
          isOpen
          item={item}
          onOpenChange={(open) => !open && setAction(null)}
        />
      ) : null}
      {action === 'adjust' ? (
        <AdjustModal
          branchId={branchId}
          branchName={branchName}
          isOpen
          item={item}
          onOpenChange={(open) => !open && setAction(null)}
        />
      ) : null}
      {action === 'delete' ? (
        <DeleteItemDialog
          isOpen
          item={item}
          onOpenChange={(open) => !open && setAction(null)}
        />
      ) : null}
    </>
  );
}

// --- Tabla -----------------------------------------------------------------

function ItemsTable(props: {
  items: InventoryItem[];
  branchId: string;
  branchName: string;
  branches: Branch[];
  canWrite: boolean;
  canIssue: boolean;
  isAdmin: boolean;
}) {
  if (props.items.length === 0) {
    return (
      <div className="flex flex-col items-center gap-1 rounded-lg border border-dashed border-border py-16 text-center">
        <p className="text-sm font-medium text-foreground">
          No hay ítems que coincidan
        </p>
        <p className="text-sm text-muted-foreground">
          Ajusta los filtros o cambia de sucursal.
        </p>
      </div>
    );
  }

  return (
    <Table variant="secondary">
      <Table.ScrollContainer>
        <Table.Content aria-label="Inventario" className="min-w-230">
          <Table.Header>
            <Table.Column isRowHeader>SKU</Table.Column>
            <Table.Column>Nombre</Table.Column>
            <Table.Column>Stock acá</Table.Column>
            <Table.Column>Total empresa</Table.Column>
            <Table.Column>Mínimo</Table.Column>
            <Table.Column>Estado</Table.Column>
            <Table.Column>Acciones</Table.Column>
          </Table.Header>
          <Table.Body>
            {props.items.map((item) => (
              <ItemRow
                key={item.id}
                branchId={props.branchId}
                branchName={props.branchName}
                branches={props.branches}
                canIssue={props.canIssue}
                canWrite={props.canWrite}
                isAdmin={props.isAdmin}
                item={item}
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
  const [onlyBelowMinimum, setOnlyBelowMinimum] = useState(false);

  const { data: branches } = useBranches({ isActive: true });

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
  });

  const items = useMemo(() => {
    const all = data ?? [];
    if (!onlyBelowMinimum) return all;
    return all.filter((item) => isBelowMinimumAt(item, branchId));
  }, [data, onlyBelowMinimum, branchId]);

  const belowMinimumCount = useMemo(
    () => (data ?? []).filter((item) => isBelowMinimumAt(item, branchId)).length,
    [data, branchId],
  );

  // El consumo se registra donde operan las máquinas. Se deriva de si la
  // bodega tiene equipos asignados (`Equipment.homeBranch`) en vez de comparar
  // el nombre contra "Faena": el modelo todavía no tiene un campo que diga qué
  // sucursal es operativa — está propuesto como `Branch.isOperational`.
  const { data: branchEquipment } = useEquipment(
    branchId ? { homeBranchId: branchId } : {},
  );
  const canIssue = canWrite && (branchEquipment?.length ?? 0) > 0;

  const tableProps = {
    branchId,
    branchName,
    branches: branches ?? [],
    canWrite,
    canIssue,
    isAdmin,
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
            Suministros y repuestos por bodega, con su mínimo de reposición y el
            movimiento de cada salida.
          </p>
        </div>
        {isAdmin && branchId ? (
          <NewItemModal
            branchId={branchId}
            branchName={branchName}
            defaultType={tab}
          />
        ) : null}
      </div>

      <div className="flex flex-wrap items-end gap-4">
        <Select
          className="w-full sm:w-56"
          value={branchId}
          onChange={(value) => {
            if (value) setSelectedBranchId(String(value));
          }}
        >
          <Label>Sucursal</Label>
          <Select.Trigger>
            <Select.Value />
            <Select.Indicator />
          </Select.Trigger>
          <Select.Popover>
            <ListBox>
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

        <TextField
          aria-label="Buscar ítem"
          className="w-full sm:w-64"
          value={search}
          onChange={setSearch}
        >
          <Label>Buscar</Label>
          <Input placeholder="SKU, nombre o nº de parte" />
        </TextField>

        <Switch
          className="pb-2.5"
          isSelected={onlyBelowMinimum}
          onChange={setOnlyBelowMinimum}
        >
          Solo bajo mínimo
        </Switch>

        {canWrite && branchId && !canIssue ? (
          <Chip className="mb-2.5" size="sm" variant="soft">
            {branchName} no tiene equipos asignados: solo recibe material
          </Chip>
        ) : null}

        {belowMinimumCount > 0 ? (
          <Chip className="mb-2.5" color="warning" size="sm" variant="soft">
            {belowMinimumCount} bajo el mínimo en {branchName}
          </Chip>
        ) : null}
      </div>

      {isError ? (
        <div className="rounded-lg bg-danger-soft px-4 py-3 text-sm text-danger-soft-foreground">
          {error instanceof Error
            ? error.message
            : 'No se pudo obtener el inventario.'}
        </div>
      ) : null}

      <Tabs
        selectedKey={tab}
        onSelectionChange={(key) => setTab(String(key) as ItemType)}
      >
        {/* Sin `<Tabs.Indicator />`: en esta versión de HeroUI revienta con
            "<SharedElement> must be rendered inside a <SharedElementTransition>"
            — el indicador usa `SelectionIndicator` de react-aria-components, que
            necesita un provider que `Tabs.Root` no monta. Es decorativo; las
            pestañas funcionan igual. Mismo problema en `MantenimientoView`. */}
        <Tabs.List aria-label="Tipo de ítem">
          <Tabs.Tab id="SUPPLY">Suministros</Tabs.Tab>
          <Tabs.Tab id="PART">Repuestos</Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel id="SUPPLY">
          {isPending ? (
            <div className="flex justify-center py-16">
              <Spinner color="accent" size="lg" />
            </div>
          ) : (
            <ItemsTable items={items} {...tableProps} />
          )}
        </Tabs.Panel>
        <Tabs.Panel id="PART">
          {isPending ? (
            <div className="flex justify-center py-16">
              <Spinner color="accent" size="lg" />
            </div>
          ) : (
            <ItemsTable items={items} {...tableProps} />
          )}
        </Tabs.Panel>
      </Tabs>
    </div>
  );
}
