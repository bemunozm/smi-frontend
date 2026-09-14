import type { ReactNode } from 'react';
import { Button, Dropdown, Label } from '@heroui/react';
import {
  CheckCircle2,
  EllipsisVertical,
  OctagonAlert,
  TriangleAlert,
} from 'lucide-react';

import type { InventoryItem, ItemStock } from '../../types/inventory';

export const NUMBER = new Intl.NumberFormat('es-CL', {
  maximumFractionDigits: 2,
});

/** Centinela del selector: "todas" no es un id de sucursal. */
export const ALL_BRANCHES = '__all__';

// --- Estado de existencias -------------------------------------------------

export type StatusTone = 'ok' | 'riesgo' | 'peligro';

/**
 * Cuánto por encima del mínimo se considera que el ítem "va a caer". Es un
 * supuesto nuestro, no una regla del negocio: el modelo solo guarda el mínimo,
 * y sin un margen no existiría el estado ámbar — se pasaría de verde a rojo sin
 * aviso, que es justo cuando ya es tarde para comprar.
 *
 * 25 % es el valor de partida. Si la empresa define su propio margen (o un
 * punto de reorden por ítem), este número sale de acá y pasa al modelo.
 */
const RISK_MARGIN = 1.25;

export interface StockStatus {
  label: string;
  tone: StatusTone;
}

/**
 * Estado de UNA bodega. Tres escalones, y el color significa siempre lo mismo:
 *
 * - **verde · OK** — hay holgura sobre el mínimo. No hay nada que hacer.
 * - **ámbar · Riesgo de stock bajo** — todavía no cruza el mínimo, pero le
 *   queda poco. Es el único momento útil para comprar sin urgencia.
 * - **rojo · Bajo stock mínimo / Sin stock** — hay que reponer ya.
 *
 * Con `minimumQuantity = 0` la bodega no fijó umbral: no hay contra qué medir
 * la holgura, así que solo se distingue "hay" de "no hay".
 */
function statusOf(stock: ItemStock | undefined): StockStatus {
  const quantity = stock?.quantity ?? 0;
  const minimum = stock?.minimumQuantity ?? 0;

  if (quantity <= 0) return { label: 'Sin stock', tone: 'peligro' };
  if (minimum <= 0) return { label: 'OK', tone: 'ok' };
  if (quantity <= minimum)
    return { label: 'Bajo stock mínimo', tone: 'peligro' };
  if (quantity <= minimum * RISK_MARGIN)
    return { label: 'Riesgo de stock bajo', tone: 'riesgo' };
  return { label: 'OK', tone: 'ok' };
}

const WORST: Record<StatusTone, number> = { ok: 0, riesgo: 1, peligro: 2 };

/**
 * Estado del ítem en la bodega elegida, o **el peor de todas** cuando se está
 * mirando el inventario general.
 *
 * El peor y no el promedio: si Faena está sin filtros y Casa Matriz sobrada, el
 * ítem tiene un problema, y promediarlo lo escondería detrás de un verde.
 */
export function stockStatus(
  item: InventoryItem,
  branchId: string | typeof ALL_BRANCHES,
): StockStatus {
  if (branchId !== ALL_BRANCHES) {
    return statusOf(item.stocks.find((stock) => stock.branchId === branchId));
  }

  if (item.stocks.length === 0) return { label: 'Sin stock', tone: 'peligro' };

  return item.stocks
    .map(statusOf)
    .reduce((worst, current) =>
      WORST[current.tone] > WORST[worst.tone] ? current : worst,
    );
}

const TONE_STYLES: Record<
  StatusTone,
  { chip: string; icon: typeof CheckCircle2 }
> = {
  ok: {
    chip: 'bg-[var(--success-soft)] text-[var(--success-soft-foreground)]',
    icon: CheckCircle2,
  },
  riesgo: {
    chip: 'bg-[var(--warning-soft)] text-[var(--warning-soft-foreground)]',
    icon: TriangleAlert,
  },
  peligro: {
    chip: 'bg-[var(--danger-soft)] text-[var(--danger-soft-foreground)]',
    icon: OctagonAlert,
  },
};

/**
 * El chip de estado. Lleva icono además del color porque los fondos `*-soft`
 * del tema son muy lavados: a este tamaño el rosa del peligro y el amarillo del
 * riesgo se confunden. Con el icono el estado se reconoce de un vistazo aunque
 * el color no llegue — y también para quien no distingue rojo de verde.
 */
export function StatusChip({ label, tone }: StockStatus) {
  const { chip, icon: Icon } = TONE_STYLES[tone];
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-semibold ${chip}`}
    >
      <Icon aria-hidden size={13} />
      {label}
    </span>
  );
}

/**
 * Distintivo del ítem crítico. A propósito NO es un chip de color: el color en
 * esta pantalla habla del stock, y un segundo chip rojo al lado del estado
 * haría dudar de cuál de los dos es el que manda.
 */
export function CriticalBadge() {
  return (
    <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-border px-2 py-0.5 text-xs font-medium text-muted-foreground">
      Crítico
    </span>
  );
}

/**
 * Dónde está el ítem, bodega por bodega. Responde la pregunta que el total no
 * responde: "hay 55 litros, ¿pero dónde?" — que con dos faenas es la diferencia
 * entre usarlo hoy y pedir un traslado.
 */
export function BranchBreakdown({
  item,
  highlightBranchId,
}: {
  item: InventoryItem;
  highlightBranchId?: string;
}) {
  const withStock = item.stocks.filter((stock) => stock.quantity > 0);

  if (withStock.length === 0) {
    return <span className="text-sm text-muted-foreground">—</span>;
  }

  return (
    <div className="flex flex-col gap-1">
      {withStock.map((stock) => {
        const tone = stockStatus(item, stock.branchId).tone;
        return (
          <span
            className={`flex items-center gap-1.5 text-sm ${
              stock.branchId === highlightBranchId
                ? 'font-medium text-foreground'
                : 'text-muted-foreground'
            }`}
            key={stock.branchId}
          >
            {/* El punto dice cómo está ESA bodega. Sin él, "Casa Matriz 50 ·
                Faena 5" se lee como dos cifras sueltas y hay que ir al mínimo
                de cada una para saber cuál es la que preocupa. */}
            <span
              aria-hidden
              className={`size-1.5 shrink-0 rounded-full ${DOT_COLORS[tone]}`}
            />
            {stock.branch.name}{' '}
            <span className="font-mono">{NUMBER.format(stock.quantity)}</span>
          </span>
        );
      })}
    </div>
  );
}

const DOT_COLORS: Record<StatusTone, string> = {
  ok: 'bg-[var(--success)]',
  riesgo: 'bg-[var(--warning)]',
  peligro: 'bg-[var(--danger)]',
};

// --- Movimientos -----------------------------------------------------------

export type MovementKind = 'entrada' | 'salida' | 'traspaso' | 'ajuste';

/**
 * Qué clase de movimiento es, en los términos en que lo piensa el bodeguero.
 * No coincide con `direction`: un traspaso son dos asientos, uno IN y otro OUT,
 * y los dos son el mismo hecho — mostrarlos como "entrada" y "salida" haría
 * parecer que entró material que en realidad solo cambió de bodega.
 */
export function movementKind(movement: {
  direction: 'IN' | 'OUT';
  reason: string;
}): MovementKind {
  if (movement.reason === 'TRANSFER') return 'traspaso';
  if (movement.reason === 'PHYSICAL_ADJUSTMENT') return 'ajuste';
  return movement.direction === 'IN' ? 'entrada' : 'salida';
}

const KIND_STYLES: Record<MovementKind, { label: string; chip: string }> = {
  entrada: {
    label: 'Entrada',
    chip: 'bg-[var(--success-soft)] text-[var(--success-soft-foreground)]',
  },
  salida: {
    label: 'Salida',
    chip: 'bg-[var(--danger-soft)] text-[var(--danger-soft-foreground)]',
  },
  traspaso: {
    label: 'Traspaso',
    chip: 'bg-[var(--accent-soft)] text-[var(--accent-soft-foreground)]',
  },
  ajuste: {
    label: 'Ajuste',
    chip: 'bg-[var(--warning-soft)] text-[var(--warning-soft-foreground)]',
  },
};

/** La etiqueta de color del tipo de movimiento, en listados e historiales. */
export function MovementKindChip({ kind }: { kind: MovementKind }) {
  const { label, chip } = KIND_STYLES[kind];
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-xs font-semibold ${chip}`}
    >
      {label}
    </span>
  );
}

// --- Piezas de formulario --------------------------------------------------

/**
 * Control segmentado del diseño del equipo. Reemplaza a `<Tabs>` de HeroUI en
 * esta pantalla por dos razones: es lo que dibujan los tres artboards (PC,
 * tablet y teléfono), y `<Tabs.Indicator />` revienta en esta versión de HeroUI.
 */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  label,
}: {
  options: ReadonlyArray<{ id: T; label: ReactNode }>;
  value: T;
  onChange: (id: T) => void;
  label: string;
}) {
  return (
    <div
      aria-label={label}
      className="flex gap-[3px] rounded-[10px] border border-border bg-[var(--surface-tertiary)] p-[3px]"
      role="tablist"
    >
      {options.map((option) => {
        const isSelected = option.id === value;
        return (
          <button
            aria-selected={isSelected}
            className={`h-10 flex-1 rounded-[7px] px-3 text-sm font-semibold transition-colors ${
              isSelected
                ? 'bg-card text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
            key={option.id}
            onClick={() => onChange(option.id)}
            role="tab"
            type="button"
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

/** Encabezado de bloque dentro de un formulario o una hoja de acciones. */
export function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <p className="text-[11px] font-bold tracking-[0.08em] text-muted-foreground uppercase">
      {children}
    </p>
  );
}

/**
 * Cuadro de cifras de un modal: "Stock acá 60 L", "Casa Matriz 60 → 59 L". Se
 * usa en movimiento, traspaso y conteo para que la decisión se tome mirando los
 * números, sin tener que cerrar el modal para ir a ver la fila.
 */
export function StatBox({
  rows,
}: {
  rows: ReadonlyArray<{ label: string; value: ReactNode }>;
}) {
  return (
    <div className="flex flex-col gap-1 rounded-lg border border-border px-3 py-2 text-sm">
      {rows.map((row) => (
        <div className="flex items-center justify-between gap-3" key={row.label}>
          <span className="text-muted-foreground">{row.label}</span>
          <span className="font-mono text-foreground">{row.value}</span>
        </div>
      ))}
    </div>
  );
}

/** Botón de la grilla de acciones rápidas (teléfono y tablet). */
export function QuickAction({
  icon,
  label,
  isDanger,
  isDisabled,
  onPress,
}: {
  icon: ReactNode;
  label: string;
  isDanger?: boolean;
  isDisabled?: boolean;
  onPress: () => void;
}) {
  return (
    <button
      className="flex min-h-22 cursor-pointer flex-col items-center justify-center gap-2 rounded-[14px] border border-border bg-card px-2 py-3 text-center text-[12.5px] font-semibold text-foreground hover:bg-[var(--surface-secondary)] disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:bg-card"
      disabled={isDisabled}
      onClick={onPress}
      type="button"
    >
      <span
        className={`inline-flex size-10 items-center justify-center rounded-[11px] ${
          isDanger
            ? 'bg-danger-soft text-danger-soft-foreground'
            : 'bg-[var(--accent-soft)] text-[var(--accent-soft-foreground)]'
        }`}
      >
        {icon}
      </span>
      {label}
    </button>
  );
}

export interface RowMenuOption {
  id: string;
  label: string;
  icon: ReactNode;
  isDanger?: boolean;
}

/**
 * Las acciones de una fila, detrás de los tres puntos.
 *
 * Cuatro iconos sueltos por fila obligan a reconocer cada dibujo antes de
 * apretar, y con veinte filas son ochenta objetos compitiendo por la atención
 * en una columna que casi nunca se usa. Detrás del menú las acciones tienen
 * nombre escrito, que es lo que se lee sin dudar.
 *
 * Solo en escritorio: en teléfono y tablet la tarjeta entera abre el panel, que
 * ya muestra las mismas acciones con su etiqueta.
 */
export function RowMenu({
  options,
  onAction,
  label,
}: {
  options: RowMenuOption[];
  onAction: (id: string) => void;
  label: string;
}) {
  return (
    <Dropdown>
      <Button aria-label={label} size="sm" variant="ghost">
        <EllipsisVertical size={16} />
      </Button>
      <Dropdown.Popover placement="bottom end">
        <Dropdown.Menu onAction={(key) => onAction(String(key))}>
          {options.map((option) => (
            <Dropdown.Item
              id={option.id}
              key={option.id}
              textValue={option.label}
              variant={option.isDanger ? 'danger' : undefined}
            >
              {option.icon}
              <Label>{option.label}</Label>
            </Dropdown.Item>
          ))}
        </Dropdown.Menu>
      </Dropdown.Popover>
    </Dropdown>
  );
}
