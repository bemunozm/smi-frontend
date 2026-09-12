import type { ReactNode } from 'react';

import type { InventoryItem } from '../../types/inventory';

export const NUMBER = new Intl.NumberFormat('es-CL', {
  maximumFractionDigits: 2,
});

/**
 * Dónde está lo que falta acá. Se nombran las bodegas en vez de decir "en otra
 * sucursal": el bodeguero tiene que saber a cuál pedirle, y con dos sucursales
 * "otra" ya obliga a adivinar.
 */
function elsewhereLabel(item: InventoryItem, branchId: string): string {
  const names = item.stocks
    .filter((stock) => stock.branchId !== branchId && stock.quantity > 0)
    .map((stock) => stock.branch.name);
  return `En ${names.join(' y ')}`;
}

export type StatusTone = 'ok' | 'riesgo' | 'peligro';

/**
 * El estado del ítem **en la bodega que se está mirando**, en un solo rótulo.
 *
 * Antes eran dos chips ("En esta bodega" + "Bajo mínimo") y se leían como dos
 * cosas del mismo tono. Acá hay uno solo, y el color significa siempre lo
 * mismo:
 *
 * - **verde · OK** — hay saldo y está sobre el mínimo. No hay nada que hacer.
 * - **ámbar · en riesgo** — no hay acá, pero sí en otra bodega. Se resuelve
 *   con un traspaso, no con una compra; por eso no es rojo.
 * - **rojo · peligro** — o cruzó el mínimo de esta bodega, o no hay en ninguna
 *   parte. Las dos exigen acción, y ninguna se resuelve sola.
 */
export function stockStatus(
  item: InventoryItem,
  branchId: string,
): { label: string; tone: StatusTone } {
  const here = item.stocks.find((stock) => stock.branchId === branchId);
  const quantity = here?.quantity ?? 0;
  const minimum = here?.minimumQuantity ?? 0;
  const total = item.stocks.reduce((sum, stock) => sum + stock.quantity, 0);

  if (quantity > 0) {
    // `minimumQuantity = 0` significa "esta bodega no fijó umbral" y no alerta.
    return minimum > 0 && quantity <= minimum
      ? { label: 'Bajo stock mínimo', tone: 'peligro' }
      : { label: 'OK', tone: 'ok' };
  }

  return total > 0
    ? { label: elsewhereLabel(item, branchId), tone: 'riesgo' }
    : { label: 'Sin stock', tone: 'peligro' };
}

const TONE_STYLES: Record<StatusTone, { chip: string; dot: string }> = {
  ok: {
    chip: 'bg-[var(--success-soft)] text-[var(--success-soft-foreground)]',
    dot: 'bg-[var(--success)]',
  },
  riesgo: {
    chip: 'bg-[var(--warning-soft)] text-[var(--warning-soft-foreground)]',
    dot: 'bg-[var(--warning)]',
  },
  peligro: {
    chip: 'bg-[var(--danger-soft)] text-[var(--danger-soft-foreground)]',
    dot: 'bg-[var(--danger)]',
  },
};

/**
 * El chip de estado. Lleva un punto del color saturado además del fondo suave:
 * los fondos `*-soft` del tema son tan lavados que a este tamaño el rosa del
 * peligro y el amarillo del riesgo se confunden. El punto da el color a plena
 * saturación, y el texto dice el estado — el color refuerza, no carga solo con
 * el significado.
 */
export function StatusChip({
  label,
  tone,
}: {
  label: string;
  tone: StatusTone;
}) {
  const styles = TONE_STYLES[tone];
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-semibold ${styles.chip}`}
    >
      <span aria-hidden className={`size-1.5 rounded-full ${styles.dot}`} />
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
 * Control segmentado del diseño del equipo. Reemplaza a `<Tabs>` de HeroUI en
 * esta pantalla por dos razones: es lo que dibujan los tres artboards (PC,
 * tablet y teléfono), y `<Tabs.Indicator />` revienta en esta versión de HeroUI
 * — la pestaña seleccionada se pintaba con un override en `index.css` para
 * suplirlo. Acá el estado seleccionado es parte del componente.
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

/** Encabezado de bloque dentro de una hoja de acciones. */
export function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <p className="text-[11px] font-bold tracking-[0.08em] text-muted-foreground uppercase">
      {children}
    </p>
  );
}

/**
 * Cuadro de cifras de un modal: "Stock acá 60 L", "Casa Matriz 60 → 59 L". Se
 * usa en traspaso, mínimo y conteo para que la decisión se tome mirando los
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

/** Botón de la grilla de acciones rápidas. */
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
