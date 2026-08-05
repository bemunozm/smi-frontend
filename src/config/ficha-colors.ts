import { CRITICIDADES, HALLAZGO_ESTADOS } from '../types/dashboard';
import { criticidadChipColor, hallazgoEstadoLabel } from './dashboard-colors';
import { ESTADOS_ACTIVIDAD, ESTADOS_OT } from '../types/mantenimiento';
import { estadoActividadChipColor, estadoOTChipColor } from './mantenimiento-colors';
import type { EventoFicha, EventoFichaTipo } from '../types/ficha';

/** Mismo set de colores semánticos que acepta `Chip`/`Avatar` de HeroUI. */
export type FichaChipColor = 'accent' | 'success' | 'warning' | 'danger' | 'default';

/** Type guard genérico: `value` es uno de los literales de `values`. Evita
 * `any`/`as` al angostar el `meta` (record flexible) de un `EventoFicha`
 * antes de reusar los helpers de color/label de cada dominio. */
export function isOneOf<T extends string>(values: readonly T[], value: unknown): value is T {
  return typeof value === 'string' && (values as readonly string[]).includes(value);
}

const EVENTO_TIPO_LABEL: Record<EventoFichaTipo, string> = {
  COMBUSTIBLE: 'Combustible',
  HOROMETRO: 'Horómetro',
  TRABAJO_EXTRA: 'Trabajo extra',
  HALLAZGO: 'Hallazgo',
  ORDEN_TRABAJO: 'Orden de trabajo',
  INTERVENCION: 'Intervención',
  ACTIVIDAD: 'Actividad',
};

export function eventoTipoLabel(tipo: EventoFichaTipo): string {
  return EVENTO_TIPO_LABEL[tipo];
}

/** Color base por dominio — usado cuando el evento no trae un estado/
 * prioridad propio que afinar (ver `eventoTipoColor`). */
const EVENTO_TIPO_COLOR: Record<EventoFichaTipo, FichaChipColor> = {
  COMBUSTIBLE: 'accent',
  HOROMETRO: 'default',
  TRABAJO_EXTRA: 'warning',
  HALLAZGO: 'danger',
  ORDEN_TRABAJO: 'accent',
  INTERVENCION: 'success',
  ACTIVIDAD: 'default',
};

/**
 * Color del chip de tipo en la timeline de la ficha. Para HALLAZGO,
 * ORDEN_TRABAJO y ACTIVIDAD se afina con el estado/prioridad real del
 * evento (dentro de `meta`), reusando los helpers de color que ya son
 * fuente única en cada dominio (`dashboard-colors.ts`/`mantenimiento-colors.ts`)
 * — así el chip refleja qué tan urgente/abierto está el evento, no solo su
 * tipo. El resto de dominios (COMBUSTIBLE, HOROMETRO, TRABAJO_EXTRA,
 * INTERVENCION) no tienen un estado propio en la ficha, así que usan el
 * color fijo de `EVENTO_TIPO_COLOR`.
 */
export function eventoTipoColor(evento: EventoFicha): FichaChipColor {
  if (evento.tipo === 'HALLAZGO' && isOneOf(CRITICIDADES, evento.meta.prioridad)) {
    return criticidadChipColor(evento.meta.prioridad);
  }
  if (evento.tipo === 'ORDEN_TRABAJO' && isOneOf(ESTADOS_OT, evento.meta.estado)) {
    return estadoOTChipColor(evento.meta.estado);
  }
  if (evento.tipo === 'ACTIVIDAD' && isOneOf(ESTADOS_ACTIVIDAD, evento.meta.estado)) {
    return estadoActividadChipColor(evento.meta.estado);
  }
  return EVENTO_TIPO_COLOR[evento.tipo];
}

/** Reexport para que los consumidores de la ficha (vista + item de timeline)
 * no necesiten importar `hallazgoEstadoLabel` desde dos config distintos. */
export { hallazgoEstadoLabel, HALLAZGO_ESTADOS };
