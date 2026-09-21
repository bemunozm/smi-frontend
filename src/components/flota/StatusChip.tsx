import type { FlotaChipColor } from '../../config/flota-colors';

/**
 * Reemplazo de `<Chip variant="soft"|"secondary" color={...}>` de
 * `@heroui/react` — SOLO para los usos de Flota listados abajo.
 *
 * Bug confirmado en HeroUI v3.2.3 (`@heroui/react` + `tailwind-variants`
 * 3.3.1): `ChipRoot` memoiza `chipVariants({color,size,variant})` vía
 * `useMemo(..., [color,size,variant])`, pero el className final se arma
 * llamando `slots.base()` en CADA render (`composeSlotClassName`, fuera del
 * `useMemo`). `tailwind-variants` 3.3.1 no cierra esos getters de slot sobre
 * los args de SU PROPIA llamada — leen un estado mutable COMPARTIDO por
 * todas las llamadas a `chipVariants(...)` de la app (confirmado con
 * llamadas puras a `chipVariants()`, sin React, durante la investigación:
 * crear 4 resultados con colores distintos y recién ahí leer `.base()` de
 * cada uno devuelve los 4 con el color del ÚLTIMO). Resultado: un `<Chip>`
 * cuyos props NO cambian entre renders (por eso `useMemo` no vuelve a
 * calcular) puede terminar pintado con el color de OTRO `<Chip>` de la
 * página que sí recalculó mientras tanto — exactamente el bug reportado en
 * `ResumenFlota` ("todos los chips salen `chip--danger`"), y el mismo riesgo
 * aplica a cualquier chip de estado/combustible/asignación de esta vista.
 *
 * Mitigación: clases Tailwind directas contra los tokens semánticos de
 * HeroUI (`bg-success-soft`, etc. — mismos tokens que ya usa el bloque de
 * error de `EquiposView`), sin pasar por el slot API de `tv()`.
 */
const TONE_CLASSES: Record<FlotaChipColor, string> = {
  accent: 'bg-accent-soft text-accent-soft-foreground',
  success: 'bg-success-soft text-success-soft-foreground',
  warning: 'bg-warning-soft text-warning-soft-foreground',
  danger: 'bg-danger-soft text-danger-soft-foreground',
  default: 'bg-default text-default-foreground',
};

const SIZE_CLASSES: Record<'sm' | 'md', string> = {
  sm: 'h-6 px-2.5 text-xs',
  md: 'h-7 px-3 text-[13px]',
};

interface StatusChipProps {
  tone: FlotaChipColor;
  size?: 'sm' | 'md';
  className?: string;
  children: React.ReactNode;
}

export function StatusChip({ tone, size = 'sm', className, children }: StatusChipProps) {
  return (
    <span
      className={`inline-flex w-fit shrink-0 items-center gap-0.5 rounded-full font-semibold whitespace-nowrap ${SIZE_CLASSES[size]} ${TONE_CLASSES[tone]} ${className ?? ''}`}
    >
      {children}
    </span>
  );
}
