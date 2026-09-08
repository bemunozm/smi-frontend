import { NOTIF_TIPOS, type NotificacionTipo } from '../types/notificacion';

/** Mismo set de colores semánticos que acepta `Chip`/`Avatar` de HeroUI. */
export type NotifChipColor = 'accent' | 'success' | 'warning' | 'danger' | 'default';

interface NotifTipoConfig {
  label: string;
  color: NotifChipColor;
}

const NOTIF_TIPO_CONFIG: Record<NotificacionTipo, NotifTipoConfig> = {
  [NOTIF_TIPOS.HALLAZGO_CREATED]: { label: 'Hallazgo', color: 'warning' },
  [NOTIF_TIPOS.ORDEN_ASSIGNED]: { label: 'OT asignada', color: 'accent' },
  [NOTIF_TIPOS.ORDEN_COMPLETED]: { label: 'OT completada', color: 'success' },
  [NOTIF_TIPOS.INSUMO_LOW_STOCK]: { label: 'Stock bajo', color: 'danger' },
};

/**
 * Fallback para `tipo` desconocidos: `types/notificacion.ts#NotificacionSchema`
 * valida `tipo` como `z.string()` (no `z.enum`) a propósito, así que el
 * backend puede agregar tipos nuevos sin romper la validación — este mapa de
 * colores no debe romperse tampoco.
 */
const NOTIF_TIPO_DEFAULT: NotifTipoConfig = { label: 'Notificación', color: 'default' };

/** Label + color de Chip consistente por `tipo`, con fallback para tipos no contemplados. */
export function notificacionTipoConfig(tipo: string): NotifTipoConfig {
  return NOTIF_TIPO_CONFIG[tipo as NotificacionTipo] ?? NOTIF_TIPO_DEFAULT;
}
