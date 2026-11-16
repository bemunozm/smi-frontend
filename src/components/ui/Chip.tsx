import type { HTMLAttributes, ReactNode } from 'react';

export type ChipColor = 'accent' | 'danger' | 'default' | 'success' | 'warning';
export type ChipVariant = 'primary' | 'secondary' | 'tertiary' | 'soft';
export type ChipSize = 'sm' | 'md' | 'lg';

export interface ChipProps extends HTMLAttributes<HTMLSpanElement> {
  color?: ChipColor;
  variant?: ChipVariant;
  size?: ChipSize;
  children?: ReactNode;
}

/**
 * Reemplazo directo del `<Chip>` de `@heroui/react` — misma API (`color`,
 * `variant`, `size`) y las MISMAS clases CSS de `@heroui/styles`
 * (`chip chip--accent chip--soft chip--sm`, ver `dist/components/chip.css`),
 * así que se ve idéntico.
 *
 * Por qué existe: en HeroUI 3.2.3 + `tailwind-variants` 3.3.1 los getters de
 * slot de `chipVariants()` leen un estado COMPARTIDO por todas las llamadas
 * de la app (detalle en `components/flota/StatusChip.tsx`). Un chip cuyos
 * props no cambian termina pintado con el color de otro que sí se volvió a
 * calcular: al cambiar un filtro o un estado, las prioridades y estados de
 * las tablas cambiaban de color. Acá las clases se arman a mano en cada
 * render, sin pasar por `tv()`.
 *
 * Usar SIEMPRE este `Chip`, nunca el de `@heroui/react` (lo bloquea oxlint).
 */
export function Chip({
  color = 'default',
  variant = 'secondary',
  size,
  className,
  children,
  ...props
}: ChipProps) {
  const clases = ['chip', `chip--${color}`, `chip--${variant}`, size ? `chip--${size}` : '', className ?? '']
    .filter(Boolean)
    .join(' ');
  return (
    <span {...props} className={clases} data-slot="chip">
      {typeof children === 'string' || typeof children === 'number' ? (
        <span className="chip__label" data-slot="chip-label">
          {children}
        </span>
      ) : (
        children
      )}
    </span>
  );
}
