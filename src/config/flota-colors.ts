import { ESTADOS_EQUIPO, type EstadoEquipo } from '../types/equipo';
import type { UnidadInsumo } from '../types/inventario';

/** Colores semánticos de HeroUI (Chip) — mismo criterio que `role-colors.ts`. */
export type FlotaChipColor = 'accent' | 'success' | 'warning' | 'danger' | 'default';

const ESTADO_COLOR: Record<EstadoEquipo, FlotaChipColor> = {
  DISPONIBLE: 'success',
  EN_RUTA: 'accent',
  EN_MANTENCION: 'warning',
  DE_BAJA: 'danger',
};

export function estadoEquipoChipColor(estado: EstadoEquipo): FlotaChipColor {
  return ESTADO_COLOR[estado];
}

const ESTADO_LABEL: Record<EstadoEquipo, string> = {
  DISPONIBLE: 'Disponible',
  EN_RUTA: 'En ruta',
  EN_MANTENCION: 'En mantención',
  DE_BAJA: 'De baja',
};

export function estadoEquipoLabel(estado: EstadoEquipo): string {
  return ESTADO_LABEL[estado];
}

/** Opciones `{value,label}` para los selects de estado. */
export const ESTADO_OPTIONS: ReadonlyArray<{ value: EstadoEquipo; label: string }> =
  ESTADOS_EQUIPO.map((estado) => ({ value: estado, label: ESTADO_LABEL[estado] }));

/** Símbolo corto de la unidad, para mostrar junto a las cantidades. */
const UNIDAD_SIMBOLO: Record<UnidadInsumo, string> = {
  UNIDAD: 'u',
  LITRO: 'L',
  KILOGRAMO: 'kg',
  METRO: 'm',
};

export function unidadSimbolo(unidad: UnidadInsumo): string {
  return UNIDAD_SIMBOLO[unidad];
}

export const UNIDAD_LABELS: Record<UnidadInsumo, string> = {
  UNIDAD: 'Unidades',
  LITRO: 'Litros',
  KILOGRAMO: 'Kilogramos',
  METRO: 'Metros',
};
