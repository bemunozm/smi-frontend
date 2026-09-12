import type { ReactNode } from 'react';

import type { InventoryItem } from '../../types/inventory';

export const NUMBER = new Intl.NumberFormat('es-CL', {
  maximumFractionDigits: 2,
});

/**
 * Cómo se ve una fila. Son tres situaciones distintas y cada una lleva a una
 * acción distinta, por eso no se colapsan en "hay / no hay": usar lo que está
 * acá, pedir un traspaso, o comprar. La alerta de reposición va aparte: **tener
 * poco no es no tener**.
 */
export type Availability = 'en-bodega' | 'en-otra' | 'sin-stock';

export function availability(here: number, total: number): Availability {
  if (here > 0) return 'en-bodega';
  return total > 0 ? 'en-otra' : 'sin-stock';
}

export const AVAILABILITY_COLORS: Record<
  Availability,
  'success' | 'warning' | 'danger'
> = {
  'en-bodega': 'success',
  'en-otra': 'warning',
  'sin-stock': 'danger',
};

/**
 * Dónde está lo que falta acá. Se nombran las bodegas en vez de decir "en otra
 * sucursal": el bodeguero tiene que saber a cuál pedirle, y con dos sucursales
 * "otra" ya obliga a adivinar.
 */
export function elsewhereLabel(item: InventoryItem, branchId: string): string {
  const names = item.stocks
    .filter((stock) => stock.branchId !== branchId && stock.quantity > 0)
    .map((stock) => stock.branch.name);
  if (names.length === 0) return 'Sin stock';
  return `En ${names.join(' y ')}`;
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
