import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Button,
  Chip,
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
  Pencil,
  FileText,
  Trash2,
  TriangleAlert,
} from 'lucide-react';

import {
  useAdjustStock,
  useCreateMovement,
  useDeleteItem,
  useTransferStock,
} from '../../hooks/useInventory';
import type { Branch } from '../../types/branch';
import {
  MOVEMENT_REASON_LABELS,
  REASONS_BY_DIRECTION,
  UNIT_SYMBOLS,
  quantityAt,
  stockAt,
  type InventoryItem,
  type MovementReason,
} from '../../types/inventory';
import {
  ALL_BRANCHES,
  NUMBER,
  QuickAction,
  SectionLabel,
  Segmented,
  StatBox,
  StatusChip,
  stockStatus,
} from './shared';

/**
 * Qué se está haciendo con el ítem. Son tres porque las otras dos acciones de
 * la fila viven fuera: la ficha tiene su propio formulario y el historial es
 * una pantalla.
 */
export type ItemAction = 'actions' | 'movement' | 'delete';

/**
 * Los cuatro modos del formulario de movimiento. Van juntos a propósito: las
 * cuatro operaciones responden a la misma pregunta ("¿cuánto y en qué bodega?")
 * y separarlas en cuatro botones obligaba a saber de antemano cuál era la
 * correcta. El traspaso es el caso que más se beneficia — antes estaba escondido
 * detrás de una acción distinta pese a ser, para el bodeguero, una salida que
 * entra en otro lado.
 */
type MovementMode = 'in' | 'out' | 'transfer' | 'count';

const MODE_LABELS: Record<MovementMode, string> = {
  in: 'Entrada',
  out: 'Salida',
  transfer: 'Traspaso',
  count: 'Conteo',
};

const ICON = 20;

// --- Formulario de movimiento ----------------------------------------------

function MovementPanel({
  item,
  branches,
  defaultBranchId,
  close,
  back,
}: {
  item: InventoryItem;
  branches: Branch[];
  /** Bodega preseleccionada; vacía cuando se está mirando el inventario general. */
  defaultBranchId: string;
  close: () => void;
  back: () => void;
}) {
  const createMovement = useCreateMovement();
  const transfer = useTransferStock();
  const adjust = useAdjustStock();

  const [mode, setMode] = useState<MovementMode>('in');
  const [branchId, setBranchId] = useState(
    defaultBranchId || branches[0]?.id || '',
  );
  const [destinationId, setDestinationId] = useState('');
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState<MovementReason>('PURCHASE');
  const [documentNumber, setDocumentNumber] = useState('');
  const [notes, setNotes] = useState('');

  const symbol = UNIT_SYMBOLS[item.unit];
  const here = quantityAt(item, branchId);
  const branchName =
    branches.find((branch) => branch.id === branchId)?.name ?? '';
  const others = branches.filter((branch) => branch.id !== branchId);
  const destination = others.find((branch) => branch.id === destinationId);
  const there = destinationId ? quantityAt(item, destinationId) : 0;

  const quantity = Number(amount);
  const validAmount = Number.isFinite(quantity) && quantity > 0;
  const takesStock = mode === 'out' || mode === 'transfer';
  const notEnough = takesStock && validAmount && quantity > here;
  const missingDestination = mode === 'transfer' && !destinationId;

  // El conteo no suma ni resta: se escribe lo que hay, y el sistema calcula la
  // diferencia. Por eso admite 0 y su validación es distinta.
  const counted = Number(amount);
  const validCount = Number.isFinite(counted) && counted >= 0 && amount !== '';
  const difference = validCount ? counted - here : 0;

  const canSubmit =
    !!branchId &&
    !notEnough &&
    !missingDestination &&
    (mode === 'count' ? validCount : validAmount);

  const isPending =
    createMovement.isPending || transfer.isPending || adjust.isPending;

  function resultingBalance(): string {
    if (mode === 'count') return validCount ? NUMBER.format(counted) : '—';
    if (!validAmount) return '—';
    return NUMBER.format(mode === 'in' ? here + quantity : here - quantity);
  }

  function submit(): void {
    const onSuccess = { onSuccess: () => close() };

    if (mode === 'transfer') {
      transfer.mutate(
        {
          itemId: item.id,
          sourceBranchId: branchId,
          destinationBranchId: destinationId,
          quantity,
          ...(documentNumber.trim()
            ? { documentNumber: documentNumber.trim() }
            : {}),
          ...(notes.trim() ? { notes: notes.trim() } : {}),
        },
        onSuccess,
      );
      return;
    }

    if (mode === 'count') {
      adjust.mutate(
        {
          id: item.id,
          input: {
            branchId,
            countedQuantity: counted,
            ...(notes.trim() ? { notes: notes.trim() } : {}),
          },
        },
        onSuccess,
      );
      return;
    }

    createMovement.mutate(
      {
        input: {
          itemId: item.id,
          branchId,
          direction: mode === 'in' ? 'IN' : 'OUT',
          reason,
          quantity,
          ...(documentNumber.trim()
            ? { documentNumber: documentNumber.trim() }
            : {}),
          ...(notes.trim() ? { notes: notes.trim() } : {}),
        },
        item,
      },
      onSuccess,
    );
  }

  return (
    <>
      <Modal.Body>
        <div className="flex flex-col gap-4">
          <BackButton onPress={back} />
          <SectionLabel>Registrar movimiento</SectionLabel>

          <Segmented
            label="Tipo de movimiento"
            onChange={(next) => {
              setMode(next);
              setAmount(next === 'count' ? String(here) : '');
              setReason(next === 'in' ? 'PURCHASE' : 'INTERVENTION');
            }}
            options={[
              { id: 'in', label: MODE_LABELS.in },
              { id: 'out', label: MODE_LABELS.out },
              { id: 'transfer', label: MODE_LABELS.transfer },
              { id: 'count', label: MODE_LABELS.count },
            ]}
            value={mode}
          />

          <Select
            fullWidth
            onChange={(value) => {
              if (value) setBranchId(String(value));
            }}
            value={branchId}
          >
            <Label>{mode === 'transfer' ? 'Sucursal de origen' : 'Sucursal'}</Label>
            <Select.Trigger>
              <Select.Value />
              <Select.Indicator />
            </Select.Trigger>
            <Select.Popover>
              <ListBox>
                {branches.map((branch) => (
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

          {mode === 'transfer' ? (
            <Select
              fullWidth
              onChange={(value) => {
                if (value) setDestinationId(String(value));
              }}
              value={destinationId}
            >
              <Label>Sucursal de destino</Label>
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
          ) : null}

          <TextField fullWidth onChange={setAmount} value={amount}>
            <Label>
              {mode === 'count' ? 'Stock contado' : 'Cantidad'} ({symbol})
            </Label>
            <Input autoFocus inputMode="decimal" placeholder="0" />
          </TextField>

          {mode === 'in' || mode === 'out' ? (
            <Select
              fullWidth
              onChange={(value) => {
                if (value) setReason(String(value) as MovementReason);
              }}
              value={reason}
            >
              <Label>Motivo / origen</Label>
              <Select.Trigger>
                <Select.Value />
                <Select.Indicator />
              </Select.Trigger>
              <Select.Popover>
                <ListBox>
                  {REASONS_BY_DIRECTION[mode === 'in' ? 'IN' : 'OUT'].map(
                    (option) => (
                      <ListBox.Item
                        id={option}
                        key={option}
                        textValue={MOVEMENT_REASON_LABELS[option]}
                      >
                        {MOVEMENT_REASON_LABELS[option]}
                        <ListBox.ItemIndicator />
                      </ListBox.Item>
                    ),
                  )}
                </ListBox>
              </Select.Popover>
            </Select>
          ) : null}

          <StatBox
            rows={[
              {
                label: `Stock en ${branchName || 'la sucursal'}`,
                value: `${NUMBER.format(here)} ${symbol}`,
              },
              {
                label: mode === 'count' ? 'Queda registrado' : 'Queda después',
                value: `${resultingBalance()} ${symbol}`,
              },
              ...(mode === 'transfer' && destination
                ? [
                    {
                      label: destination.name,
                      value: `${NUMBER.format(there)} → ${NUMBER.format(
                        validAmount ? there + quantity : there,
                      )} ${symbol}`,
                    },
                  ]
                : []),
            ]}
          />

          {mode === 'count' && validCount && difference !== 0 ? (
            <Chip
              color={difference > 0 ? 'success' : 'warning'}
              size="sm"
              variant="soft"
            >
              Diferencia: {difference > 0 ? '+' : ''}
              {NUMBER.format(difference)} {symbol}
            </Chip>
          ) : null}

          {mode !== 'count' ? (
            <TextField
              fullWidth
              onChange={setDocumentNumber}
              value={documentNumber}
            >
              <Label>Documento (opcional)</Label>
              <Input placeholder="N.º de guía, OC…" />
            </TextField>
          ) : null}

          <TextField fullWidth onChange={setNotes} value={notes}>
            <Label>Observación (opcional)</Label>
            <Input placeholder="Notas adicionales" />
          </TextField>

          {mode === 'transfer' ? (
            <p className="rounded-lg bg-[var(--accent-soft)] px-3 py-2 text-xs text-[var(--accent-soft-foreground)]">
              Genera dos asientos con el mismo folio: salida en{' '}
              {branchName || 'el origen'} y entrada en{' '}
              {destination?.name ?? 'el destino'}. El total de la empresa no
              cambia.
            </p>
          ) : null}

          {notEnough ? (
            <p className="flex items-start gap-2 rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger-soft-foreground">
              <TriangleAlert className="mt-0.5 shrink-0" size={16} />
              <span>
                En {branchName} hay {NUMBER.format(here)} {symbol}: no alcanza
                para {mode === 'transfer' ? 'mover' : 'sacar'}{' '}
                {NUMBER.format(quantity)}.
              </span>
            </p>
          ) : null}
        </div>
      </Modal.Body>
      <Modal.Footer>
        <Button onPress={back} variant="secondary">
          Volver
        </Button>
        <Button isDisabled={!canSubmit} isPending={isPending} onPress={submit}>
          {({ isPending: pending }) =>
            pending ? <Spinner color="current" size="sm" /> : 'Registrar'
          }
        </Button>
      </Modal.Footer>
    </>
  );
}

// --- Baja ------------------------------------------------------------------

function DeletePanel({
  item,
  close,
  back,
}: {
  item: InventoryItem;
  close: () => void;
  back: () => void;
}) {
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
            historial y sugiere darlo de baja en su lugar.
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

// --- Modal -----------------------------------------------------------------

export function ItemActionsModal({
  item,
  branchId,
  branches,
  canWrite,
  isAdmin,
  initialView,
  isOpen,
  onOpenChange,
  onEdit,
}: {
  item: InventoryItem;
  /** Sucursal en foco, o `ALL_BRANCHES` en el inventario general. */
  branchId: string;
  branches: Branch[];
  canWrite: boolean;
  isAdmin: boolean;
  /** Permite que la fila de escritorio abra directo la acción elegida. */
  initialView: ItemAction;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit: () => void;
}) {
  const [view, setView] = useState<ItemAction>(initialView);
  const navigate = useNavigate();

  const symbol = UNIT_SYMBOLS[item.unit];
  const isAll = branchId === ALL_BRANCHES;
  const status = stockStatus(item, branchId);
  const here = isAll ? null : quantityAt(item, branchId);
  const minimum = isAll ? 0 : (stockAt(item, branchId)?.minimumQuantity ?? 0);
  const branchName = branches.find((b) => b.id === branchId)?.name ?? '';
  const total = item.stocks.reduce((sum, stock) => sum + stock.quantity, 0);

  return (
    <Modal.Backdrop isOpen={isOpen} onOpenChange={onOpenChange}>
      <Modal.Container>
        <Modal.Dialog className="sm:max-w-lg">
          {({ close }) => {
            const back = () => setView('actions');

            return (
              <>
                <Modal.CloseTrigger />
                <Modal.Header>
                  <div className="flex flex-wrap items-center gap-2">
                    <Modal.Heading className="font-mono text-xl font-semibold">
                      {item.sku}
                    </Modal.Heading>
                    <StatusChip label={status.label} tone={status.tone} />
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {item.name}
                    {item.partNumber ? ` · N° parte ${item.partNumber}` : ''}
                    <br />
                    {isAll ? (
                      <>
                        Total en la empresa:{' '}
                        <span className="font-mono font-semibold text-foreground">
                          {NUMBER.format(total)} {symbol}
                        </span>
                      </>
                    ) : (
                      <>
                        Existencia en {branchName}:{' '}
                        <span className="font-mono font-semibold text-foreground">
                          {NUMBER.format(here ?? 0)} {symbol}
                        </span>
                        {minimum > 0
                          ? ` · mín ${NUMBER.format(minimum)}`
                          : ' · sin mínimo fijado'}
                      </>
                    )}
                  </p>
                </Modal.Header>

                {view === 'actions' ? (
                  <>
                    <Modal.Body>
                      <SectionLabel>Acciones</SectionLabel>
                      <div className="mt-3 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
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
                        {canWrite ? (
                          <QuickAction
                            icon={<ArrowLeftRight size={ICON} />}
                            label="Registrar movimiento"
                            onPress={() => setView('movement')}
                          />
                        ) : null}
                        <QuickAction
                          icon={<FileText size={ICON} />}
                          label="Ver ficha"
                          onPress={() => {
                            close();
                            void navigate(`/inventario/${item.id}`);
                          }}
                        />
                        {isAdmin ? (
                          <QuickAction
                            icon={<Trash2 size={ICON} />}
                            isDanger
                            label="Eliminar"
                            onPress={() => setView('delete')}
                          />
                        ) : null}
                      </div>
                    </Modal.Body>
                    <Modal.Footer>
                      <Button onPress={close} variant="secondary">
                        Cerrar
                      </Button>
                    </Modal.Footer>
                  </>
                ) : null}

                {view === 'movement' ? (
                  <MovementPanel
                    back={back}
                    branches={branches}
                    close={close}
                    defaultBranchId={isAll ? '' : branchId}
                    item={item}
                  />
                ) : null}

                {view === 'delete' ? (
                  <DeletePanel back={back} close={close} item={item} />
                ) : null}
              </>
            );
          }}
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}
