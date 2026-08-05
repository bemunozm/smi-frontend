import {
  ESTADO_ACTIVIDAD,
  ESTADO_OT,
  ORIGEN_ACTIVIDAD,
  ORIGEN_OT,
  PRIORIDAD_OT,
  TIPO_OT,
  type EstadoActividad,
  type EstadoOT,
  type OrigenActividad,
  type OrigenOT,
  type PrioridadOT,
  type TipoOT,
} from '../types/mantenimiento';

/** Mismo set de colores semánticos que acepta `Chip`/`Avatar` de HeroUI. */
export type StatusChipColor = 'accent' | 'success' | 'warning' | 'danger' | 'default';

const ESTADO_OT_COLOR: Record<EstadoOT, StatusChipColor> = {
  [ESTADO_OT.PENDIENTE]: 'default',
  [ESTADO_OT.ASIGNADA]: 'accent',
  [ESTADO_OT.EN_PROCESO]: 'warning',
  [ESTADO_OT.COMPLETADA]: 'success',
  [ESTADO_OT.CANCELADA]: 'danger',
};

export function estadoOTChipColor(estado: EstadoOT): StatusChipColor {
  return ESTADO_OT_COLOR[estado];
}

export const ESTADO_OT_LABELS: Record<EstadoOT, string> = {
  [ESTADO_OT.PENDIENTE]: 'Pendiente',
  [ESTADO_OT.ASIGNADA]: 'Asignada',
  [ESTADO_OT.EN_PROCESO]: 'En proceso',
  [ESTADO_OT.COMPLETADA]: 'Completada',
  [ESTADO_OT.CANCELADA]: 'Cancelada',
};

export const ESTADO_OT_OPTIONS: ReadonlyArray<{ value: EstadoOT; label: string }> = (
  Object.values(ESTADO_OT) as EstadoOT[]
).map((estado) => ({ value: estado, label: ESTADO_OT_LABELS[estado] }));

const PRIORIDAD_OT_COLOR: Record<PrioridadOT, StatusChipColor> = {
  [PRIORIDAD_OT.BAJA]: 'default',
  [PRIORIDAD_OT.MEDIA]: 'accent',
  [PRIORIDAD_OT.ALTA]: 'warning',
  [PRIORIDAD_OT.CRITICA]: 'danger',
};

export function prioridadOTChipColor(prioridad: PrioridadOT): StatusChipColor {
  return PRIORIDAD_OT_COLOR[prioridad];
}

export const PRIORIDAD_OT_LABELS: Record<PrioridadOT, string> = {
  [PRIORIDAD_OT.BAJA]: 'Baja',
  [PRIORIDAD_OT.MEDIA]: 'Media',
  [PRIORIDAD_OT.ALTA]: 'Alta',
  [PRIORIDAD_OT.CRITICA]: 'Crítica',
};

export const PRIORIDAD_OT_OPTIONS: ReadonlyArray<{ value: PrioridadOT; label: string }> = (
  Object.values(PRIORIDAD_OT) as PrioridadOT[]
).map((prioridad) => ({ value: prioridad, label: PRIORIDAD_OT_LABELS[prioridad] }));

export const TIPO_OT_LABELS: Record<TipoOT, string> = {
  [TIPO_OT.CORRECTIVA]: 'Correctiva',
  [TIPO_OT.PREVENTIVA]: 'Preventiva',
};

export const TIPO_OT_OPTIONS: ReadonlyArray<{ value: TipoOT; label: string }> = (
  Object.values(TIPO_OT) as TipoOT[]
).map((tipo) => ({ value: tipo, label: TIPO_OT_LABELS[tipo] }));

export const ORIGEN_OT_LABELS: Record<OrigenOT, string> = {
  [ORIGEN_OT.MANUAL]: 'Manual',
  [ORIGEN_OT.PREVENTIVO]: 'Preventivo',
  [ORIGEN_OT.HALLAZGO]: 'Hallazgo',
};

export const ORIGEN_OT_OPTIONS: ReadonlyArray<{ value: OrigenOT; label: string }> = (
  Object.values(ORIGEN_OT) as OrigenOT[]
).map((origen) => ({ value: origen, label: ORIGEN_OT_LABELS[origen] }));

const ESTADO_ACTIVIDAD_COLOR: Record<EstadoActividad, StatusChipColor> = {
  [ESTADO_ACTIVIDAD.PENDIENTE]: 'warning',
  [ESTADO_ACTIVIDAD.COMPLETADA]: 'success',
};

export function estadoActividadChipColor(estado: EstadoActividad): StatusChipColor {
  return ESTADO_ACTIVIDAD_COLOR[estado];
}

export const ESTADO_ACTIVIDAD_LABELS: Record<EstadoActividad, string> = {
  [ESTADO_ACTIVIDAD.PENDIENTE]: 'Pendiente',
  [ESTADO_ACTIVIDAD.COMPLETADA]: 'Completada',
};

/** `MANUAL` se muestra como "Libre" — mismo lenguaje que usaba el mock. */
export const ORIGEN_ACTIVIDAD_LABELS: Record<OrigenActividad, string> = {
  [ORIGEN_ACTIVIDAD.HALLAZGO]: 'Hallazgo',
  [ORIGEN_ACTIVIDAD.EQUIPO]: 'Equipo',
  [ORIGEN_ACTIVIDAD.MANUAL]: 'Libre',
};

export const ORIGEN_ACTIVIDAD_OPTIONS: ReadonlyArray<{ value: OrigenActividad; label: string }> = (
  Object.values(ORIGEN_ACTIVIDAD) as OrigenActividad[]
).map((origen) => ({ value: origen, label: ORIGEN_ACTIVIDAD_LABELS[origen] }));
