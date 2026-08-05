import type { Criticidad, HallazgoEstado } from '../types/dashboard';

/** Colores semánticos de HeroUI (Chip) aceptados por estos mapeos. */
export type DashboardChipColor = 'accent' | 'success' | 'warning' | 'danger' | 'default';

const CRITICIDAD_COLOR: Record<Criticidad, DashboardChipColor> = {
  BAJA: 'default',
  MEDIA: 'warning',
  ALTA: 'danger',
  CRITICA: 'danger',
};

/** Color de Chip consistente por criticidad — mismo patrón que `roleChipColor`. */
export function criticidadChipColor(criticidad: Criticidad): DashboardChipColor {
  return CRITICIDAD_COLOR[criticidad];
}

const ESTADO_COLOR: Record<HallazgoEstado, DashboardChipColor> = {
  ABIERTO: 'default',
  EN_PROCESO: 'accent',
  CERRADO: 'success',
};

export function hallazgoEstadoChipColor(estado: HallazgoEstado): DashboardChipColor {
  return ESTADO_COLOR[estado];
}

const ESTADO_LABEL: Record<HallazgoEstado, string> = {
  ABIERTO: 'Abierto',
  EN_PROCESO: 'En proceso',
  CERRADO: 'Cerrado',
};

export function hallazgoEstadoLabel(estado: HallazgoEstado): string {
  return ESTADO_LABEL[estado];
}
