import {
  CONTROL_UNIT,
  DOCUMENT_STATUS,
  EQUIPMENT_CLASS,
  EQUIPMENT_STATUS,
  type ControlUnit,
  type DocumentStatus,
  type Equipment,
  type EquipmentClass,
  type EquipmentStatus,
} from '../types/equipment';
import { EQUIPMENT_DOCUMENT_TYPES, type EquipmentDocumentType } from '../types/equipment-document';

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

/**
 * Clases del botón "Cambiar estado" cuando representa el estado ACTUAL del
 * equipo, en la hoja de acciones de `EquiposView` (tablet/celular) — mismo
 * par de tokens "soft" que ya pinta `StatusChip` (bg-{tono}-soft +
 * texto {tono}-soft-foreground: el look de chip de estado lleno que se ve en
 * el encabezado de la propia hoja), más un borde sólido del mismo tono para
 * que se lea "estás acá" incluso junto a los botones no seleccionados
 * (blancos). Clases completas (no interpoladas), mismo criterio que
 * `FUEL_TONE_CLASSES`.
 */
const EQUIPMENT_STATUS_SELECTED_CLASSES: Record<EquipmentStatus, string> = {
  OPERATIONAL: 'border-success bg-success-soft text-success-soft-foreground',
  IN_WORKSHOP: 'border-warning bg-warning-soft text-warning-soft-foreground',
  OUT_OF_SERVICE: 'border-danger bg-danger-soft text-danger-soft-foreground',
};

export function equipmentStatusSelectedClasses(status: EquipmentStatus): string {
  return EQUIPMENT_STATUS_SELECTED_CLASSES[status];
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

const CONTROL_UNIT_SUFFIX: Record<ControlUnit, string> = {
  KM: 'km',
  HOURS: 'h',
};

/** Sufijo corto de unidad ("h"/"km") — usado en los modales de ENTRADA/
 * SALIDA de horómetro (Flota) para el label del campo y el preview de uso
 * (`valorFinal − valorInicial`), y en el historial de la ficha. */
export function controlUnitSuffix(unit: ControlUnit): string {
  return CONTROL_UNIT_SUFFIX[unit];
}

const CONTROL_UNIT_MARCADOR: Record<ControlUnit, string> = {
  KM: 'odómetro',
  HOURS: 'horómetro',
};

/** Nombre del marcador físico a fotografiar ("horómetro"/"odómetro") — usado
 * en el título de `PhotoCaptureField` de los modales de ENTRADA/SALIDA. */
export function controlUnitMarcador(unit: ControlUnit): string {
  return CONTROL_UNIT_MARCADOR[unit];
}

const TURNO_LABEL: Record<string, string> = {
  DIURNO: 'Diurno',
  NOCTURNO: 'Nocturno',
};

/** Etiqueta legible del turno de un `RegistroHorometro` (`DIURNO`/
 * `NOCTURNO`) — con fallback al valor crudo si llega algo fuera del enum
 * conocido (el backend lo tipa como `string`, no como enum, ver
 * `types/horometro.ts`). */
export function turnoLabel(turno: string): string {
  return TURNO_LABEL[turno] ?? turno;
}

/**
 * Tonos por umbral de combustible (≤20% peligro, ≤50% advertencia, resto
 * éxito) — calca `FlotaClientePC.dc.html#fuelColor`. Fuente única para
 * `FuelGauge` (barra chica de tabla/tarjeta) y `EquipoDetalleView` (barra
 * grande de "Nivel actual" + badge del KPI de combustible, Fase 2): mismo
 * umbral, solo cambian los tokens de color entre una barra sólida y un
 * badge "soft". Las clases van completas (no interpoladas) porque Tailwind
 * necesita verlas literales en el código para generarlas.
 */
export const FUEL_TONE_CLASSES = {
  danger: { bar: 'bg-danger', text: 'text-danger', soft: 'bg-danger-soft text-danger-soft-foreground' },
  warning: { bar: 'bg-warning', text: 'text-warning', soft: 'bg-warning-soft text-warning-soft-foreground' },
  success: { bar: 'bg-success', text: 'text-success', soft: 'bg-success-soft text-success-soft-foreground' },
} as const;

export function fuelTone(pct: number): keyof typeof FUEL_TONE_CLASSES {
  if (pct <= 20) return 'danger';
  if (pct <= 50) return 'warning';
  return 'success';
}

/**
 * R1/R2 — vigencia de revisión técnica/seguro. Mismo criterio semántico que
 * `EQUIPMENT_STATUS_COLOR`: vigente en verde, por vencer en ámbar, vencido en
 * rojo; `SIN_DATO` queda neutro (no es un error, simplemente no se cargó la
 * fecha todavía).
 */
const DOCUMENT_STATUS_COLOR: Record<DocumentStatus, FlotaChipColor> = {
  VIGENTE: 'success',
  POR_VENCER: 'warning',
  VENCIDO: 'danger',
  SIN_DATO: 'default',
};

export function documentStatusChipColor(status: DocumentStatus): FlotaChipColor {
  return DOCUMENT_STATUS_COLOR[status];
}

const DOCUMENT_STATUS_LABEL: Record<DocumentStatus, string> = {
  VIGENTE: 'Vigente',
  POR_VENCER: 'Por vencer',
  VENCIDO: 'Vencido',
  SIN_DATO: 'Sin dato',
};

export function documentStatusLabel(status: DocumentStatus): string {
  return DOCUMENT_STATUS_LABEL[status];
}

/** Opciones `{value,label}` — sin uso en un selector hoy (R1/R2 es solo
 * lectura), se deja por paridad con el resto de los vocabularios de este
 * archivo, para un futuro filtro de la ficha/listado por vigencia. */
export const DOCUMENT_STATUS_OPTIONS: ReadonlyArray<{ value: DocumentStatus; label: string }> =
  DOCUMENT_STATUS.map((value) => ({ value, label: DOCUMENT_STATUS_LABEL[value] }));

/** "Vence en 12 días" / "Vencido hace 5 días" / "Vence hoy" / "Sin registro"
 * — caption bajo el chip de vigencia de un documento (`EquipoDetalleView` —
 * dominio "Documentos de equipo", `types/equipment-document.ts`), derivada de
 * `daysToExpiry` (ya calculado on-read por el backend, no se recalcula acá
 * para no desincronizarse del reloj que usó el server). Tipado estructural
 * (no `EquipmentDocument` completo) para que un `Pick` baste en el call site. */
export function documentExpiryCaption(info: { daysToExpiry: number | null }): string {
  if (info.daysToExpiry == null) return 'Sin registro';
  if (info.daysToExpiry === 0) return 'Vence hoy';
  if (info.daysToExpiry > 0) {
    return `Vence en ${info.daysToExpiry} día${info.daysToExpiry === 1 ? '' : 's'}`;
  }
  const dias = Math.abs(info.daysToExpiry);
  return `Vencido hace ${dias} día${dias === 1 ? '' : 's'}`;
}

const EQUIPMENT_DOCUMENT_TYPE_LABEL: Record<EquipmentDocumentType, string> = {
  TECHNICAL_INSPECTION: 'Revisión técnica',
  INSURANCE: 'Seguro',
  CIRCULATION_PERMIT: 'Permiso de circulación',
  CERTIFICATION: 'Certificación',
  OTHER: 'Otro',
};

export function equipmentDocumentTypeLabel(type: EquipmentDocumentType): string {
  return EQUIPMENT_DOCUMENT_TYPE_LABEL[type];
}

/** Opciones `{value,label}` para el selector de tipo del modal de crear/
 * editar documento (`EquipmentDocumentModal`). */
export const EQUIPMENT_DOCUMENT_TYPE_OPTIONS: ReadonlyArray<{ value: EquipmentDocumentType; label: string }> =
  EQUIPMENT_DOCUMENT_TYPES.map((value) => ({ value, label: EQUIPMENT_DOCUMENT_TYPE_LABEL[value] }));

/**
 * "Estado de uso" de un equipo — fuente ÚNICA para `AsignacionCell`
 * (`EquiposView`, listado PC/tarjeta) y `EstadoDeUso` (`EquipoDetalleView`,
 * ficha): antes cada vista tenía su propio branching inline y divergieron —
 * sin asignación, la ficha mostraba siempre "Disponible" ignorando
 * `equipo.status`, mientras el listado ya distinguía "Disponible"/"Detenido"
 * contra ese mismo status. Mismo equipo, dos textos.
 *
 * Regla única: `operator` asignado → "En uso"; si no, `supervisor` asignado
 * → "Supervisado"; si ninguno, el estado operativo del equipo decide entre
 * "Disponible" (`OPERATIONAL`) y "Detenido" (`IN_WORKSHOP`/`OUT_OF_SERVICE`).
 * Cada consumidor mantiene su propia presentación (chip vs. texto, colores);
 * este helper solo decide el STRING.
 */
export function equipoEstadoUsoLabel(
  equipo: Pick<Equipment, 'operator' | 'supervisor' | 'status'>,
): string {
  if (equipo.operator) return 'En uso';
  if (equipo.supervisor) return 'Supervisado';
  return equipo.status === 'OPERATIONAL' ? 'Disponible' : 'Detenido';
}

/**
 * R3 — vista diferenciada por clase (fuente única, sin branching duplicado en
 * los 3 puntos de render: tabla PC, card mobile, header de la ficha).
 *
 * Regla de negocio: un equipo PESADO se identifica de un vistazo por su
 * patente (identificador prominente); uno LIVIANO se identifica por
 * patente+marca+modelo juntos. Un pesado sin patente cargada (frecuente:
 * maquinaria que nunca circula por vía pública) cae con gracia al criterio
 * de hoy — el código interno ya visible en los 3 renders sigue siendo el
 * identificador, sin dejar un hueco vacío ni repetirlo.
 */
export interface EquipoIdentidad {
  /** Patente destacada aparte (misma jerarquía visual que el código
   * interno) — SOLO en equipos pesados con patente cargada. `null` en
   * livianos (ahí la patente va integrada en `marcaModelo`, no repetida) y
   * en pesados sin patente (fallback silencioso). */
  patenteDestacada: string | null;
  /** "Patente · Marca Modelo" en livianos con patente cargada; "Marca
   * Modelo" a secas en el resto de los casos (pesados, o livianos sin
   * patente) — nunca queda vacío. */
  marcaModelo: string;
}

export function equipoIdentidad(
  equipo: Pick<Equipment, 'equipmentClass' | 'licensePlate' | 'brand' | 'model'>,
): EquipoIdentidad {
  const patente = equipo.licensePlate?.trim() || null;
  const marcaModelo = `${equipo.brand} ${equipo.model}`;

  if (equipo.equipmentClass === 'HEAVY') {
    return { patenteDestacada: patente, marcaModelo };
  }
  return {
    patenteDestacada: null,
    marcaModelo: patente ? `${patente} · ${marcaModelo}` : marcaModelo,
  };
}
