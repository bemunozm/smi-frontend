import type { Criticidad, HallazgoEstado, HallazgosPorCriticidad } from '../types/dashboard';

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
 * gráficos se veían sin marcas (ejes/leyenda sí, líneas/barras no).
 * Copiados 1:1 de los valores reales de `index.css` — si la paleta del tema
 * cambia, actualizar ambos archivos.
 */
const HEX = {
  accent: '#1d4ed8',
  success: '#12813f',
  warning: '#92590a',
  danger: '#b01818',
  muted: '#5b6470',
  foreground: '#14171c',
  surface: '#ffffff',
  surfaceSecondary: '#f2f4f6',
  border: '#d8dce1',
  overlayShadow: '0 24px 64px rgba(20, 23, 28, 0.14), 0 8px 16px rgba(20, 23, 28, 0.08)',
} as const;

export const CHART_FILL: Record<DashboardChipColor, string> = {
  accent: HEX.accent,
  success: HEX.success,
  warning: HEX.warning,
  danger: HEX.danger,
  default: HEX.muted,
};

/** Elementos neutros de los gráficos (ejes, grid, tooltip) — mismos hex literales que `CHART_FILL`, por la razón de arriba. */
export const CHART_NEUTRAL = {
  surface: HEX.surface,
  foreground: HEX.foreground,
  muted: HEX.muted,
  border: HEX.border,
  surfaceSecondary: HEX.surfaceSecondary,
  overlayShadow: HEX.overlayShadow,
} as const;

/** Serie "abiertos vs cerrados" del gráfico de tendencia de hallazgos —
 * mismo par que usa `hallazgoEstadoChipColor` para EN_PROCESO/CERRADO, así
 * la lectura del área coincide con los chips de las listas. */
export const HALLAZGOS_TENDENCIA_COLOR = {
  abiertos: CHART_FILL.accent,
  cerrados: CHART_FILL.success,
} as const;

/** Serie única de los gráficos de barras de una sola métrica (horas, vueltas) — un solo hue, sin
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

/** Estados de la franja HOY: verde en uso, neutro disponible, rojo inoperativo. */
export type EstadoHoy = 'EN_USO' | 'DISPONIBLE' | 'INOPERATIVO';

const ESTADO_HOY_COLOR: Record<EstadoHoy, DashboardChipColor> = {
  EN_USO: 'success',
  DISPONIBLE: 'default',
  INOPERATIVO: 'danger',
};

export function estadoHoyChipColor(estado: EstadoHoy): DashboardChipColor {
  return ESTADO_HOY_COLOR[estado];
}

const ESTADO_HOY_LABEL: Record<EstadoHoy, string> = {
  EN_USO: 'En uso',
  DISPONIBLE: 'Disponible',
  INOPERATIVO: 'Inoperativo',
};

export function estadoHoyLabel(estado: EstadoHoy): string {
  return ESTADO_HOY_LABEL[estado];
}

/**
 * Fondos plenos de las 5 tarjetas de la portada («resumen del día»), con texto
 * blanco como la lámina del cliente. Hex literales (mismo precedente que `HEX`
 * arriba): los tokens semánticos no traen ámbar/naranjo/morado. Tonos -700 de
 * Tailwind (ámbar -800), contraste >= 4.5:1 contra blanco incluso con el texto chico al 95%.
 */
export const RESUMEN_CARD_BG = {
  hm: '#92400e',
  diesel: '#15803d',
  reports: '#c2410c',
  produccion: '#1d4ed8',
  adBlue: '#7e22ce',
} as const;
