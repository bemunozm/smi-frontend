import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm, useWatch } from 'react-hook-form';
import {
  Button,
  Chip,
  FieldError,
  Input,
  Label,
  ListBox,
  Modal,
  Select,
  Spinner,
  TextField,
} from '@heroui/react';
import {
  ArrowLeft,
  ArrowLeftRight,
  ClipboardCheck,
  MoveVertical,
  Pencil,
  ScrollText,
  Trash2,
  TriangleAlert,
} from 'lucide-react';

import {
  useAdjustStock,
  useCreateMovement,
  useDeleteItem,
  useSetMinimum,
  useTransferStock,
} from '../../hooks/useInventory';
import type { Branch } from '../../types/branch';
import {
  AdjustFormSchema,
  MOVEMENT_REASON_LABELS,
  MinimumFormSchema,
  MovementFormSchema,
  REASONS_BY_DIRECTION,
  UNIT_SYMBOLS,
  isBelowMinimumAt,
  quantityAt,
  stockAt,
  totalQuantity,
  type AdjustFormValues,
  type InventoryItem,
  type MinimumFormValues,
  type MovementDirection,
  type MovementFormValues,
} from '../../types/inventory';
import {
  AVAILABILITY_COLORS,
  NUMBER,
  QuickAction,
  SectionLabel,
  Segmented,
  StatBox,
  availability,
  elsewhereLabel,
} from './shared';

/**
 * Qué se está haciendo con el ítem. El diseño del equipo resuelve las acciones
 * de una fila con UN panel que cambia de contenido, en vez de seis enlaces
 * sueltos en una columna: en el teléfono no hay columna de acciones donde
 * ponerlos, y en el escritorio seis enlaces obligan a leerlos todos para
 * encontrar el que se busca.
 */
type ActionView =
  | 'actions'
  | 'movement'
  | 'transfer'
  | 'minimum'
  | 'count'
  | 'delete';

interface PanelProps {
  item: InventoryItem;
  branchId: string;
  branchName: string;
  close: () => void;
  back: () => void;
}

const ICON = 20;

// --- Movimiento ------------------------------------------------------------

function MovementPanel({
  item,
  branchId,
  branchName,
  canIssue,
  close,
  back,
}: PanelProps & { canIssue: boolean }) {
  const createMovement = useCreateMovement();
  const [direction, setDirection] = useState<MovementDirection>('IN');

  const symbol = UNIT_SYMBOLS[item.unit];
  const here = quantityAt(item, branchId);
  const reasons = REASONS_BY_DIRECTION[direction];

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<MovementFormValues>({
    resolver: zodResolver(MovementFormSchema),
    values: {
      quantity: '',
      reason: reasons[0],
      equipmentId: '',
      notes: '',
    },
  });

  const typed = Number(useWatch({ control, name: 'quantity' }));
  const valid = Number.isFinite(typed) && typed > 0;
  const notEnough = direction === 'OUT' && valid && typed > here;

  const onSubmit = (values: MovementFormValues): void => {
    createMovement.mutate(
      {
        input: {
          itemId: item.id,
          branchId,
          direction,
          reason: values.reason,
          quantity: Number(values.quantity),
          ...(values.notes.trim() ? { notes: values.notes.trim() } : {}),
        },
        item,
      },
      { onSuccess: () => close() },
    );
  };

  return (
    <>
      <Modal.Body>
        <form
          className="flex flex-col gap-4"
          id={`movement-form-${item.id}`}
          noValidate
          onSubmit={(event) => void handleSubmit(onSubmit)(event)}
        >
          <BackButton onPress={back} />
          <SectionLabel>Registrar movimiento</SectionLabel>

          {/* La salida solo se ofrece donde se consume material. En una bodega
              sin equipos asignados no hay nada que consumir: lo que sale de
              ahí sale por traspaso, y ese es otro asiento. */}
          {canIssue ? (
            <Segmented
              label="Dirección del movimiento"
              onChange={setDirection}
              options={[
                { id: 'IN', label: 'Entrada' },
                { id: 'OUT', label: 'Salida' },
              ]}
              value={direction}
            />
          ) : null}

          <StatBox
            rows={[
              {
                label: `Stock en ${branchName}`,
                value: `${NUMBER.format(here)} ${symbol}`,
              },
              {
                label: 'Queda después',
                value: valid
                  ? `${NUMBER.format(
                      direction === 'IN' ? here + typed : here - typed,
                    )} ${symbol}`
                  : '—',
              },
            ]}
          />

          <Controller
            control={control}
            name="quantity"
            render={({ field }) => (
              <TextField
                fullWidth
                isInvalid={!!errors.quantity}
                name={field.name}
                onBlur={field.onBlur}
                onChange={field.onChange}
                value={field.value}
              >
                <Label>Cantidad ({symbol})</Label>
                <Input autoFocus inputMode="decimal" placeholder="0" />
                {errors.quantity ? (
                  <FieldError>{errors.quantity.message}</FieldError>
                ) : null}
              </TextField>
            )}
          />

          <Controller
            control={control}
            name="reason"
            render={({ field }) => (
              <Select
                fullWidth
                name={field.name}
                onChange={(value) => {
                  if (value) field.onChange(value);
                }}
                value={field.value}
              >
                <Label>Motivo</Label>
                <Select.Trigger>
                  <Select.Value />
                  <Select.Indicator />
                </Select.Trigger>
                <Select.Popover>
                  <ListBox>
                    {reasons.map((reason) => (
                      <ListBox.Item
                        id={reason}
                        key={reason}
                        textValue={MOVEMENT_REASON_LABELS[reason]}
                      >
                        {MOVEMENT_REASON_LABELS[reason]}
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
            name="notes"
            render={({ field }) => (
              <TextField
                fullWidth
                name={field.name}
                onBlur={field.onBlur}
                onChange={field.onChange}
                value={field.value}
              >
                <Label>Observación (opcional)</Label>
                <Input placeholder="Ej. compra al proveedor habitual" />
              </TextField>
            )}
          />

          {notEnough ? (
            <Alert tone="danger">
              En {branchName} hay {NUMBER.format(here)} {symbol}: no alcanza para
              sacar {NUMBER.format(typed)}.
            </Alert>
          ) : null}
        </form>
      </Modal.Body>
      <Modal.Footer>
        <Button onPress={back} variant="secondary">
          Volver
        </Button>
        <Button
          form={`movement-form-${item.id}`}
          isDisabled={notEnough}
          isPending={createMovement.isPending}
          type="submit"
        >
          {({ isPending }) =>
            isPending ? <Spinner color="current" size="sm" /> : 'Guardar'
          }
        </Button>
      </Modal.Footer>
    </>
  );
}

// --- Traspaso --------------------------------------------------------------

/**
 * Mostrar los dos saldos resultantes no es adorno: mover material entre faenas
 * es la operación más cara de deshacer (hay que traerlo de vuelta), y el error
 * típico es sacar de más de la bodega que justo estaba al límite. Verlo antes
 * de apretar evita el viaje.
 */
function TransferPanel({
  item,
  branchId,
  branchName,
  branches,
  close,
  back,
}: PanelProps & { branches: Branch[] }) {
  const transfer = useTransferStock();
  const others = branches.filter((branch) => branch.id !== branchId);
  const [destination, setDestination] = useState(others[0]?.id ?? '');
  const [amount, setAmount] = useState('');

  const symbol = UNIT_SYMBOLS[item.unit];
  const here = quantityAt(item, branchId);
  const minimum = stockAt(item, branchId)?.minimumQuantity ?? 0;
  const there = destination ? quantityAt(item, destination) : 0;
  const destinationName =
    others.find((branch) => branch.id === destination)?.name ?? 'Destino';

  const quantity = Number(amount);
  const valid = Number.isFinite(quantity) && quantity > 0;
  const notEnough = valid && quantity > here;
  const leavesBelowMinimum =
    valid && !notEnough && minimum > 0 && here - quantity <= minimum;

  return (
    <>
      <Modal.Body>
        <div className="flex flex-col gap-4">
          <BackButton onPress={back} />
          <SectionLabel>Traspasar a otra sucursal</SectionLabel>

          <TextField
            fullWidth
            onChange={setAmount}
            value={amount}
          >
            <Label>Cantidad ({symbol})</Label>
            <Input autoFocus inputMode="decimal" placeholder="0" />
          </TextField>

          <Select
            fullWidth
            onChange={(value) => {
              if (value) setDestination(String(value));
            }}
            value={destination}
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

          {/* El traspaso no crea ni destruye material: lo que sale de una
              bodega entra en la otra. */}
          <StatBox
            rows={[
              {
                label: branchName,
                value: `${NUMBER.format(here)} → ${NUMBER.format(
                  valid ? here - quantity : here,
                )} ${symbol}`,
              },
              {
                label: destinationName,
                value: `${NUMBER.format(there)} → ${NUMBER.format(
                  valid ? there + quantity : there,
                )} ${symbol}`,
              },
            ]}
          />

          {notEnough ? (
            <Alert tone="danger">
              En {branchName} hay {NUMBER.format(here)} {symbol}: no alcanza para
              mover {NUMBER.format(quantity)}.
            </Alert>
          ) : null}

          {leavesBelowMinimum ? (
            <Alert tone="warning">
              {branchName} queda en {NUMBER.format(here - quantity)} {symbol}, en
              o bajo su mínimo de {NUMBER.format(minimum)}.
            </Alert>
          ) : null}
        </div>
      </Modal.Body>
      <Modal.Footer>
        <Button onPress={back} variant="secondary">
          Volver
        </Button>
        <Button
          isDisabled={!valid || !destination || notEnough}
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
            isPending ? (
              <Spinner color="current" size="sm" />
            ) : (
              'Confirmar traspaso'
            )
          }
        </Button>
      </Modal.Footer>
    </>
  );
}

// --- Mínimo ----------------------------------------------------------------

function MinimumPanel({ item, branchId, branchName, close, back }: PanelProps) {
  const setMinimum = useSetMinimum();
  const symbol = UNIT_SYMBOLS[item.unit];
  const here = quantityAt(item, branchId);
  const current = stockAt(item, branchId)?.minimumQuantity ?? 0;

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<MinimumFormValues>({
    resolver: zodResolver(MinimumFormSchema),
    values: { minimumQuantity: String(current) },
  });

  // Se mira lo escrito para decir, antes de guardar, si ese umbral deja el
  // ítem alertando hoy mismo. Un mínimo se fija contra el saldo real de la
  // bodega, y ese saldo está a la vista dos líneas más arriba.
  const typed = Number(useWatch({ control, name: 'minimumQuantity' }));
  const willAlert = Number.isFinite(typed) && typed > 0 && here <= typed;

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
      <Modal.Body>
        <form
          className="flex flex-col gap-4"
          id={`minimum-form-${item.id}`}
          noValidate
          onSubmit={(event) => void handleSubmit(onSubmit)(event)}
        >
          <BackButton onPress={back} />
          <SectionLabel>Stock mínimo en {branchName}</SectionLabel>

          <StatBox
            rows={[
              {
                label: `Stock en ${branchName}`,
                value: `${NUMBER.format(here)} ${symbol}`,
              },
              {
                label: 'Mínimo vigente',
                value:
                  current > 0
                    ? `${NUMBER.format(current)} ${symbol}`
                    : 'sin umbral',
              },
            ]}
          />

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
                <Label>Stock mínimo ({symbol})</Label>
                <Input autoFocus inputMode="decimal" />
                {errors.minimumQuantity ? (
                  <FieldError>{errors.minimumQuantity.message}</FieldError>
                ) : null}
              </TextField>
            )}
          />

          {willAlert ? (
            <Alert tone="warning">
              Con {NUMBER.format(typed)} {symbol} el ítem queda marcado bajo
              mínimo de inmediato: en {branchName} hay {NUMBER.format(here)}.
            </Alert>
          ) : null}

          <p className="text-xs text-muted-foreground">
            El umbral aplica solo a esta bodega — el de la empresa y el de una
            sucursal no son la misma magnitud. En <strong>0</strong> esta bodega
            deja de alertar por este ítem.
          </p>
        </form>
      </Modal.Body>
      <Modal.Footer>
        <Button onPress={back} variant="secondary">
          Volver
        </Button>
        <Button
          form={`minimum-form-${item.id}`}
          isPending={setMinimum.isPending}
          type="submit"
        >
          {({ isPending }) =>
            isPending ? <Spinner color="current" size="sm" /> : 'Guardar'
          }
        </Button>
      </Modal.Footer>
    </>
  );
}

// --- Conteo físico ---------------------------------------------------------

function CountPanel({ item, branchId, branchName, close, back }: PanelProps) {
  const adjust = useAdjustStock();
  const symbol = UNIT_SYMBOLS[item.unit];
  const here = quantityAt(item, branchId);

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<AdjustFormValues>({
    resolver: zodResolver(AdjustFormSchema),
    values: { countedQuantity: String(here), notes: '' },
  });

  const counted = Number(useWatch({ control, name: 'countedQuantity' }));
  const difference = Number.isFinite(counted) ? counted - here : 0;

  const onSubmit = (values: AdjustFormValues): void => {
    adjust.mutate(
      {
        id: item.id,
        input: {
          branchId,
          countedQuantity: Number(values.countedQuantity),
          ...(values.notes.trim() ? { notes: values.notes.trim() } : {}),
        },
      },
      { onSuccess: () => close() },
    );
  };

  return (
    <>
      <Modal.Body>
        <form
          className="flex flex-col gap-4"
          id={`count-form-${item.id}`}
          noValidate
          onSubmit={(event) => void handleSubmit(onSubmit)(event)}
        >
          <BackButton onPress={back} />
          <SectionLabel>Ajustar por conteo</SectionLabel>

          <p className="text-sm text-muted-foreground">
            El sistema tiene{' '}
            <strong className="text-foreground">
              {NUMBER.format(here)} {symbol}
            </strong>{' '}
            en {branchName}. Ingresa lo que contaste en bodega y se registra la
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
                <Label>Stock contado ({symbol})</Label>
                <Input autoFocus inputMode="decimal" />
                {errors.countedQuantity ? (
                  <FieldError>{errors.countedQuantity.message}</FieldError>
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
              {NUMBER.format(difference)} {symbol}
            </Chip>
          ) : (
            <Chip size="sm" variant="soft">
              Sin diferencia con el sistema
            </Chip>
          )}

          <Controller
            control={control}
            name="notes"
            render={({ field }) => (
              <TextField
                fullWidth
                name={field.name}
                onBlur={field.onBlur}
                onChange={field.onChange}
                value={field.value}
              >
                <Label>Observación (opcional)</Label>
                <Input placeholder="Ej. conteo mensual de bodega" />
              </TextField>
            )}
          />
        </form>
      </Modal.Body>
      <Modal.Footer>
        <Button onPress={back} variant="secondary">
          Volver
        </Button>
        <Button
          form={`count-form-${item.id}`}
          isPending={adjust.isPending}
          type="submit"
        >
          {({ isPending }) =>
            isPending ? <Spinner color="current" size="sm" /> : 'Guardar ajuste'
          }
        </Button>
      </Modal.Footer>
    </>
  );
}

// --- Baja ------------------------------------------------------------------

function DeletePanel({ item, close, back }: PanelProps) {
  const deleteItem = useDeleteItem();

  return (
    <>
      <Modal.Body>
        <div className="flex flex-col gap-4">
          <BackButton onPress={back} />
          <SectionLabel>Eliminar ítem</SectionLabel>
          <p className="text-sm text-muted-foreground">
            ¿Seguro que quieres eliminar{' '}
            <strong className="text-foreground">{item.name}</strong> ({item.sku}
            )? Si ya tiene movimientos, el backend lo impide para no perder su
            kardex y sugiere darlo de baja en su lugar.
          </p>
        </div>
      </Modal.Body>
      <Modal.Footer>
        <Button onPress={back} variant="secondary">
          Cancelar
        </Button>
        <Button
          isPending={deleteItem.isPending}
          onPress={() => deleteItem.mutate(item.id, { onSuccess: () => close() })}
          variant="danger"
        >
          {({ isPending }) =>
            isPending ? <Spinner color="current" size="sm" /> : 'Eliminar'
          }
        </Button>
      </Modal.Footer>
    </>
  );
}

// --- Piezas chicas ---------------------------------------------------------

function BackButton({ onPress }: { onPress: () => void }) {
  return (
    <button
      aria-label="Volver a las acciones"
      className="-ml-1 inline-flex size-8 items-center justify-center self-start rounded-lg text-muted-foreground hover:bg-[var(--surface-secondary)]"
      onClick={onPress}
      type="button"
    >
      <ArrowLeft size={18} />
    </button>
  );
}

function Alert({
  tone,
  children,
}: {
  tone: 'danger' | 'warning';
  children: React.ReactNode;
}) {
  return (
    <p
      className={`flex items-start gap-2 rounded-lg px-3 py-2 text-sm ${
        tone === 'danger'
          ? 'bg-danger-soft text-danger-soft-foreground'
          : 'bg-warning-soft text-warning-soft-foreground'
      }`}
    >
      <TriangleAlert className="mt-0.5 shrink-0" size={16} />
      <span>{children}</span>
    </p>
  );
}

// --- Modal -----------------------------------------------------------------

export function ItemActionsModal({
  item,
  branchId,
  branchName,
  branches,
  canWrite,
  canIssue,
  isAdmin,
  isOpen,
  onOpenChange,
  onEdit,
}: {
  item: InventoryItem;
  branchId: string;
  branchName: string;
  branches: Branch[];
  canWrite: boolean;
  /** Solo las bodegas con equipos consumen material. Ver `InventarioView`. */
  canIssue: boolean;
  isAdmin: boolean;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  /** La ficha se edita en su propio formulario, que vive en la vista. */
  onEdit: () => void;
}) {
  const [view, setView] = useState<ActionView>('actions');
  const navigate = useNavigate();

  const symbol = UNIT_SYMBOLS[item.unit];
  const here = quantityAt(item, branchId);
  const minimum = stockAt(item, branchId)?.minimumQuantity ?? 0;
  const state = availability(here, totalQuantity(item));
  const belowMinimum = isBelowMinimumAt(item, branchId);

  return (
    <Modal.Backdrop isOpen={isOpen} onOpenChange={onOpenChange}>
      <Modal.Container>
        <Modal.Dialog className="sm:max-w-lg">
          {({ close }) => {
            const panelProps = {
              item,
              branchId,
              branchName,
              close,
              back: () => setView('actions'),
            };

            return (
              <>
                <Modal.CloseTrigger />
                <Modal.Header>
                  <div className="flex flex-wrap items-center gap-2">
                    <Modal.Heading className="font-mono text-xl font-semibold">
                      {item.sku}
                    </Modal.Heading>
                    <Chip
                      color={AVAILABILITY_COLORS[state]}
                      size="sm"
                      variant="soft"
                    >
                      {state === 'en-bodega'
                        ? 'En esta bodega'
                        : elsewhereLabel(item, branchId)}
                    </Chip>
                    {belowMinimum ? (
                      <Chip color="danger" size="sm" variant="soft">
                        Bajo mínimo
                      </Chip>
                    ) : null}
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {item.name}
                    {item.partNumber ? ` · N° parte ${item.partNumber}` : ''}
                    <br />
                    Existencia en {branchName}:{' '}
                    <span className="font-mono font-semibold text-foreground">
                      {NUMBER.format(here)} {symbol}
                    </span>
                    {minimum > 0 ? (
                      <> · mín {NUMBER.format(minimum)}</>
                    ) : (
                      <> · sin mínimo fijado</>
                    )}
                  </p>
                </Modal.Header>

                {view === 'actions' ? (
                  <>
                    <Modal.Body>
                      <SectionLabel>Acciones rápidas</SectionLabel>
                      <div className="mt-3 grid grid-cols-2 gap-2.5 sm:grid-cols-3">
                        {canWrite ? (
                          <QuickAction
                            icon={<MoveVertical size={ICON} />}
                            label="Registrar movimiento"
                            onPress={() => setView('movement')}
                          />
                        ) : null}
                        {canWrite && branches.length > 1 ? (
                          <QuickAction
                            icon={<ArrowLeftRight size={ICON} />}
                            label="Traspasar a otra sucursal"
                            onPress={() => setView('transfer')}
                          />
                        ) : null}
                        {canWrite ? (
                          <QuickAction
                            icon={<TriangleAlert size={ICON} />}
                            label="Stock mínimo"
                            onPress={() => setView('minimum')}
                          />
                        ) : null}
                        {isAdmin ? (
                          <QuickAction
                            icon={<ClipboardCheck size={ICON} />}
                            label="Ajustar por conteo"
                            onPress={() => setView('count')}
                          />
                        ) : null}
                        <QuickAction
                          icon={<ScrollText size={ICON} />}
                          label="Ver kardex"
                          onPress={() => {
                            close();
                            void navigate(`/inventario/${item.id}`);
                          }}
                        />
                        {isAdmin ? (
                          <QuickAction
                            icon={<Pencil size={ICON} />}
                            label="Editar ítem"
                            onPress={() => {
                              onOpenChange(false);
                              onEdit();
                            }}
                          />
                        ) : null}
                        {isAdmin ? (
                          <QuickAction
                            icon={<Trash2 size={ICON} />}
                            isDanger
                            label="Eliminar"
                            onPress={() => setView('delete')}
                          />
                        ) : null}
                      </div>

                      {canWrite && !canIssue ? (
                        <p className="mt-4 text-xs text-muted-foreground">
                          {branchName} no tiene equipos asignados: acá el
                          material entra y se traspasa, pero no se consume.
                        </p>
                      ) : null}
                    </Modal.Body>
                    <Modal.Footer>
                      <Button onPress={close} variant="secondary">
                        Cerrar
                      </Button>
                    </Modal.Footer>
                  </>
                ) : null}

                {view === 'movement' ? (
                  <MovementPanel canIssue={canIssue} {...panelProps} />
                ) : null}
                {view === 'transfer' ? (
                  <TransferPanel branches={branches} {...panelProps} />
                ) : null}
                {view === 'minimum' ? <MinimumPanel {...panelProps} /> : null}
                {view === 'count' ? <CountPanel {...panelProps} /> : null}
                {view === 'delete' ? <DeletePanel {...panelProps} /> : null}
              </>
            );
          }}
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}
