import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button, Input, Label, Modal, Spinner, TextField } from '@heroui/react';
import { ChevronDown, Plus, X } from 'lucide-react';
import { Button as AriaButton, Dialog, DialogTrigger, Popover } from 'react-aria-components';

import { useEquipment } from '../../hooks/useEquipment';
import { sameEquipments, toCompatibilityEntries, useSaveItemEquipments } from '../../hooks/useInventory';
import type { Equipment } from '../../types/equipment';
import type { CompatibilityEntry, InventoryItem, ItemEquipment } from '../../types/inventory';
import { Chip } from '../ui/Chip';

/** Cuántos equipos de un ítem se muestran como código antes de agruparlos en «Varios». */
const MAX_VISIBLE = 1;

/** El detalle completo («EXC-01, CAM-02») para el `title` del chip «Varios». */
export function equipmentsTitle(equipments: readonly ItemEquipment[]): string {
  return equipments.map((e) => (e.note ? `${e.internalCode} (${e.note})` : e.internalCode)).join(', ');
}

/**
 * Los equipos de un ítem en la lista: un equipo → su código; varios → «Varios · N»,
 * que se toca para ver cuáles son (pedido del cliente, 24/11/2026); ninguno → «—».
 *
 * `inline`: dentro de algo que ya es un botón (la tarjeta del celular) no se
 * puede anidar otro, así que ahí se muestran todos los códigos a la vista.
 */
export function ItemEquipmentsCell({
  equipments,
  inline = false,
}: {
  equipments: readonly ItemEquipment[];
  inline?: boolean;
}) {
  if (equipments.length === 0) return <span className="text-sm text-muted-foreground">—</span>;
  if (inline || equipments.length <= MAX_VISIBLE) {
    return (
      <span className="flex flex-wrap gap-1">
        {equipments.map((e) => (
          <Chip color="accent" key={e.equipmentId} size="sm" title={e.note ?? undefined} variant="soft">
            {e.internalCode}
          </Chip>
        ))}
      </span>
    );
  }
  return (
    <DialogTrigger>
      <AriaButton
        aria-label={`Ver los ${equipments.length} equipos: ${equipmentsTitle(equipments)}`}
        className="inline-flex cursor-pointer items-center gap-1 rounded-full whitespace-nowrap bg-(--accent-soft) px-2.5 py-1 text-xs font-semibold text-(--accent) transition-colors outline-none hover:brightness-95 focus-visible:ring-2 focus-visible:ring-(--accent)"
      >
        {`Varios · ${equipments.length}`}
        <ChevronDown aria-hidden className="h-3.5 w-3.5" />
      </AriaButton>
      <Popover
        className="min-w-56 rounded-2xl border border-border bg-card p-2 shadow-[0_18px_44px_rgba(20,23,28,.18)] outline-none"
        offset={6}
        placement="bottom start"
      >
        <Dialog aria-label="Equipos asignados" className="outline-none">
          <p className="px-2 pt-1 pb-2 text-[11px] font-semibold tracking-wider text-(--label-color) uppercase">
            Equipos asignados
          </p>
          <ul className="flex flex-col">
            {equipments.map((e) => (
              <li className="flex items-baseline justify-between gap-3 rounded-lg px-2 py-1.5 hover:bg-(--surface-secondary)" key={e.equipmentId}>
                <EquipmentLink equipmentId={e.equipmentId} internalCode={e.internalCode} />
                {e.note ? <span className="truncate text-xs text-muted-foreground">{e.note}</span> : null}
              </li>
            ))}
          </ul>
        </Dialog>
      </Popover>
    </DialogTrigger>
  );
}

/** Los códigos enlazados a la ficha del equipo (ficha del ítem). En el taller la ficha del equipo vive bajo `/mantenimiento`. */
export function EquipmentLink({
  equipmentId,
  internalCode,
  inWorkshop = false,
}: {
  equipmentId: string;
  internalCode: string;
  inWorkshop?: boolean;
}) {
  return (
    <Link
      className="font-mono text-sm font-medium text-(--accent) hover:underline"
      to={`${inWorkshop ? '/mantenimiento' : ''}/equipos/${equipmentId}`}
    >
      {internalCode}
    </Link>
  );
}

/** Edita solo los equipos de un ítem, desde su ficha (reemplaza el set completo). */
export function EditEquipmentsModal({
  item,
  isOpen,
  onOpenChange,
}: {
  item: InventoryItem;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const save = useSaveItemEquipments();
  const [inicial] = useState<CompatibilityEntry[]>(() => toCompatibilityEntries(item));
  const [entries, setEntries] = useState<CompatibilityEntry[]>(inicial);
  // Cerrar con cambios sin guardar pide confirmación (pedido del cliente, 24/11/2026): quitar con la X y
  // cerrar la ventana descartaba el cambio sin avisar.
  const [confirmarDescarte, setConfirmarDescarte] = useState(false);
  const hayCambios = !sameEquipments(entries, inicial);

  const cambiarApertura = (abierto: boolean): void => {
    if (!abierto && hayCambios && !save.isPending) {
      setConfirmarDescarte(true);
      return;
    }
    onOpenChange(abierto);
  };

  return (
    <Modal.Backdrop isOpen={isOpen} onOpenChange={cambiarApertura}>
      <Modal.Container>
        <Modal.Dialog className="sm:max-w-lg">
          <Modal.CloseTrigger />
          <Modal.Header>
            <Modal.Heading className="font-display text-xl font-semibold tracking-[-0.02em]">
              Equipos de {item.sku}
            </Modal.Heading>
          </Modal.Header>
          <Modal.Body className="flex flex-col gap-3">
            <EquipmentPicker
              onChange={(next) => {
                setEntries(next);
                setConfirmarDescarte(false);
              }}
              value={entries}
            />
            {hayCambios && !confirmarDescarte ? (
              <p className="rounded-lg bg-warning-soft px-3 py-2 text-xs text-warning-soft-foreground" role="status">
                Tienes cambios sin guardar. Se aplican al apretar «Guardar».
              </p>
            ) : null}
            {confirmarDescarte ? (
              <div
                className="flex flex-col gap-3 rounded-lg border border-warning/40 bg-warning-soft px-3 py-3 text-sm text-warning-soft-foreground"
                role="alertdialog"
                aria-label="Cambios sin guardar"
              >
                <p className="m-0 font-medium">¿Descartar los cambios? Los equipos quedarán como estaban.</p>
                <div className="flex flex-wrap justify-end gap-2">
                  <Button onPress={() => setConfirmarDescarte(false)} size="sm" variant="secondary">
                    Seguir editando
                  </Button>
                  <Button onPress={() => onOpenChange(false)} size="sm" variant="danger">
                    Descartar cambios
                  </Button>
                </div>
              </div>
            ) : null}
          </Modal.Body>
          <Modal.Footer>
            <Button onPress={() => cambiarApertura(false)} variant="secondary">
              Cancelar
            </Button>
            <Button
              isDisabled={!hayCambios}
              isPending={save.isPending}
              onPress={() => save.mutate({ item, entries }, { onSuccess: () => onOpenChange(false) })}
            >
              {({ isPending }) => (isPending ? <Spinner color="current" size="sm" /> : 'Guardar')}
            </Button>
          </Modal.Footer>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}

/** Máximo de sugerencias que se muestran bajo el buscador. */
const MAX_SUGGESTIONS = 6;

const normalize = (text: string): string => text.trim().toLowerCase();

function matches(equipment: Equipment, query: string): boolean {
  const q = normalize(query);
  if (!q) return true;
  return [equipment.internalCode, equipment.licensePlate ?? '', equipment.type, equipment.brand, equipment.model].some(
    (field) => normalize(field).includes(q),
  );
}

/**
 * Selector múltiple de equipos: búsqueda por código o patente, chips con quitar
 * y una nota opcional por equipo («solo desde serie 4500»). Controlado: el
 * formulario dueño guarda el set y lo manda al aceptar.
 */
export function EquipmentPicker({
  value,
  onChange,
  isDisabled = false,
}: {
  value: CompatibilityEntry[];
  onChange: (next: CompatibilityEntry[]) => void;
  isDisabled?: boolean;
}) {
  const { data: equipments } = useEquipment();
  const [query, setQuery] = useState('');

  const byId = useMemo(() => new Map((equipments ?? []).map((e) => [e.id, e])), [equipments]);
  const selected = useMemo(() => new Set(value.map((entry) => entry.equipmentId)), [value]);

  const suggestions = useMemo(() => {
    if (!query.trim()) return [];
    return (equipments ?? [])
      .filter((e) => !selected.has(e.id) && matches(e, query))
      .sort((a, b) => a.internalCode.localeCompare(b.internalCode, 'es-CL', { numeric: true }))
      .slice(0, MAX_SUGGESTIONS);
  }, [equipments, query, selected]);

  const add = (equipment: Equipment): void => {
    onChange([...value, { equipmentId: equipment.id }]);
    setQuery('');
  };
  const remove = (equipmentId: string): void => onChange(value.filter((e) => e.equipmentId !== equipmentId));
  const setNote = (equipmentId: string, note: string): void =>
    onChange(value.map((e) => (e.equipmentId === equipmentId ? { ...e, note } : e)));

  return (
    <div className="flex flex-col gap-3" data-testid="equipment-picker">
      <TextField
        fullWidth
        isDisabled={isDisabled}
        onChange={setQuery}
        // Enter agrega la primera coincidencia; sin esto enviaba el formulario del ítem.
        onKeyDown={(event) => {
          if (event.key !== 'Enter') return;
          event.preventDefault();
          const [first] = suggestions;
          if (first) add(first);
        }}
        value={query}
      >
        <Label>Agregar equipo</Label>
        <Input placeholder="Código o patente" />
      </TextField>

      {suggestions.length > 0 ? (
        <ul aria-label="Equipos encontrados" className="flex flex-col gap-1 rounded-lg border border-border p-1">
          {suggestions.map((equipment) => (
            <li key={equipment.id}>
              <button
                className="flex w-full cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-[var(--surface-secondary)]"
                onClick={() => add(equipment)}
                type="button"
              >
                <Plus aria-hidden className="size-4 shrink-0 text-(--accent)" />
                <span className="font-mono font-medium text-foreground">{equipment.internalCode}</span>
                <span className="truncate text-muted-foreground">
                  {[equipment.licensePlate, equipment.brand, equipment.model].filter(Boolean).join(' · ')}
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : query.trim() ? (
        <p className="text-xs text-muted-foreground">Ningún equipo coincide con «{query.trim()}».</p>
      ) : null}

      {value.length === 0 ? (
        <p className="text-xs text-muted-foreground">Sin equipos asignados. Busca arriba para agregar uno.</p>
      ) : (
        <ul className="flex flex-col gap-2" data-testid="equipment-picker-selected">
          {value.map((entry) => {
            const code = byId.get(entry.equipmentId)?.internalCode ?? entry.equipmentId;
            return (
              <li className="flex items-center gap-2" key={entry.equipmentId}>
                <Chip className="shrink-0" color="accent" variant="soft">
                  {code}
                </Chip>
                <TextField
                  aria-label={`Nota para ${code}`}
                  className="min-w-0 flex-1"
                  isDisabled={isDisabled}
                  onChange={(note) => setNote(entry.equipmentId, note)}
                  value={entry.note ?? ''}
                >
                  <Input maxLength={200} placeholder="Nota (opcional)" />
                </TextField>
                <Button
                  aria-label={`Quitar ${code}`}
                  isDisabled={isDisabled}
                  isIconOnly
                  onPress={() => remove(entry.equipmentId)}
                  size="sm"
                  variant="ghost"
                >
                  <X aria-hidden size={16} />
                </Button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
