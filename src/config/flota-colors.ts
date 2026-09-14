import {
  CONTROL_UNIT,
  EQUIPMENT_CLASS,
  EQUIPMENT_STATUS,
  type ControlUnit,
  type EquipmentClass,
  type EquipmentStatus,
} from '../types/equipment';
import type { UnidadInsumo } from '../types/inventario';

/** Colores semánticos de HeroUI (Chip) — mismo criterio que `role-colors.ts`. */
export type FlotaChipColor = 'accent' | 'success' | 'warning' | 'danger' | 'default';

const EQUIPMENT_STATUS_COLOR: Record<EquipmentStatus, FlotaChipColor> = {
  OPERATIONAL: 'success',
  IN_WORKSHOP: 'warning',
  OUT_OF_SERVICE: 'danger',
};

export function equipmentStatusChipColor(status: EquipmentStatus): FlotaChipColor {
  return EQUIPMENT_STATUS_COLOR[status];
}

const EQUIPMENT_STATUS_LABEL: Record<EquipmentStatus, string> = {
  OPERATIONAL: 'Operativo',
  IN_WORKSHOP: 'En taller',
  OUT_OF_SERVICE: 'Fuera de servicio',
};

export function equipmentStatusLabel(status: EquipmentStatus): string {
  return EQUIPMENT_STATUS_LABEL[status];
}

/** Opciones `{value,label}` para los selects de estado. */
export const EQUIPMENT_STATUS_OPTIONS: ReadonlyArray<{ value: EquipmentStatus; label: string }> =
  EQUIPMENT_STATUS.map((status) => ({ value: status, label: EQUIPMENT_STATUS_LABEL[status] }));

const EQUIPMENT_CLASS_LABEL: Record<EquipmentClass, string> = {
  LIGHT: 'Liviano',
  HEAVY: 'Pesado',
};

export function equipmentClassLabel(equipmentClass: EquipmentClass): string {
  return EQUIPMENT_CLASS_LABEL[equipmentClass];
}

/** Opciones `{value,label}` para el filtro/selector liviano vs. pesado. */
export const EQUIPMENT_CLASS_OPTIONS: ReadonlyArray<{ value: EquipmentClass; label: string }> =
  EQUIPMENT_CLASS.map((value) => ({ value, label: EQUIPMENT_CLASS_LABEL[value] }));

const CONTROL_UNIT_LABEL: Record<ControlUnit, string> = {
  KM: 'Kilometraje',
  HOURS: 'Horómetro',
};

export function controlUnitLabel(unit: ControlUnit): string {
  return CONTROL_UNIT_LABEL[unit];
}

/** Opciones `{value,label}` para el selector de unidad de control. */
export const CONTROL_UNIT_OPTIONS: ReadonlyArray<{ value: ControlUnit; label: string }> =
  CONTROL_UNIT.map((value) => ({ value, label: CONTROL_UNIT_LABEL[value] }));

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
