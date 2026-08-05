import type { EstadoEquipo } from '../types/equipo';
import type { Criticidad, HallazgoEstado, HallazgosPorCriticidad } from '../types/dashboard';
import { estadoEquipoChipColor } from './flota-colors';

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

/**
 * Puente entre los tokens semánticos de `index.css` y los gráficos de
 * Recharts. A propósito son **hex literales**, no `var(--token)`: Recharts
 * pinta con atributos SVG (`fill`/`stroke`) y, al menos en captura de
 * screenshot full-page (donde `ResponsiveContainer` puede re-medir vía
 * `ResizeObserver` y Recharts re-dispara su animación de entrada), el custom
 * property no llegaba a resolverse a tiempo para el primer paint — los 3
 * gráficos se veían sin marcas (ejes/leyenda sí, dona/líneas/barras no).
 * Copiados 1:1 de los valores reales de `index.css` — si la paleta del tema
 * cambia, actualizar ambos archivos.
 */
const HEX = {
  accent: '#1e50ea',
  success: '#0e9f6e',
  warning: '#e8a33d',
  danger: '#a31e22',
  muted: '#928d80',
  foreground: '#0d0c0a',
  surface: '#ffffff',
  surfaceSecondary: '#faf8f4',
  border: 'rgba(13, 12, 10, 0.08)',
  overlayShadow: '0 24px 64px rgba(13, 12, 10, 0.12), 0 8px 16px rgba(13, 12, 10, 0.06)',
} as const;

export const CHART_FILL: Record<DashboardChipColor, string> = {
  accent: HEX.accent,
  success: HEX.success,
  warning: HEX.warning,
  danger: HEX.danger,
  default: HEX.muted,
};

/** Elementos neutros de los 3 gráficos (ejes, grid, tooltip, borde de la
 * dona) — mismos hex literales que `CHART_FILL`, por la razón de arriba. */
export const CHART_NEUTRAL = {
  surface: HEX.surface,
  foreground: HEX.foreground,
  muted: HEX.muted,
  border: HEX.border,
  surfaceSecondary: HEX.surfaceSecondary,
  overlayShadow: HEX.overlayShadow,
} as const;

/** Color de relleno del gráfico de flota para un estado dado — puente entre
 * el color semántico de Chip que ya define `flota-colors.ts#estadoEquipoChipColor`
 * (fuente única de colores/labels de `EstadoEquipo`, dominio de Amin) y los
 * hex literales que necesita Recharts. Ya no duplica el mapeo estado→color:
 * antes vivía acá un `EQUIPO_ESTADO_COLOR` propio, desalineado del que ya
 * usan las vistas de Flota (`DE_BAJA` era `default` acá vs. `danger` en
 * `flota-colors.ts`) — se eliminó a favor de reusar el de Amin. */
export function equipoEstadoChartColor(estado: EstadoEquipo): string {
  return CHART_FILL[estadoEquipoChipColor(estado)];
}

/** Serie "abiertos vs cerrados" del gráfico de tendencia de hallazgos —
 * mismo par que usa `hallazgoEstadoChipColor` para EN_PROCESO/CERRADO, así
 * la lectura del área coincide con los chips de las listas. */
export const HALLAZGOS_TENDENCIA_COLOR = {
  abiertos: CHART_FILL.accent,
  cerrados: CHART_FILL.success,
} as const;

/** Serie única del gráfico de horas extraordinarias — un solo hue, sin
 * necesidad de leyenda (el título de la card ya dice qué se mide). */
export const TRABAJOS_EXTRAORDINARIOS_COLOR = CHART_FILL.accent;

/** Subtítulo de la card "Hallazgos abiertos": desglosa por criticidad en vez
 * de repetir el total que ya muestra el valor grande de la card. */
export function hallazgosCriticidadHint(breakdown: HallazgosPorCriticidad): string {
  const parts: string[] = [];
  if (breakdown.critica > 0) {
    parts.push(`${breakdown.critica} crítico${breakdown.critica === 1 ? '' : 's'}`);
  }
  if (breakdown.alta > 0) {
    parts.push(`${breakdown.alta} alto${breakdown.alta === 1 ? '' : 's'}`);
  }
  if (parts.length === 0) {
    return 'Sin hallazgos críticos ni altos';
  }
  return parts.join(' · ');
}
