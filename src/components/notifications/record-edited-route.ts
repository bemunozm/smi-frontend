import type { Notificacion } from '../../types/notificacion';

/** A dónde lleva el aviso de un registro corregido: la pantalla donde el
 * administrador ve ese registro y su historial de cambios. `null` si el payload
 * no trae una entidad conocida. */
const RUTAS: Record<string, string> = {
  shift_card: '/terreno/registro',
  hallazgo: '/terreno/hallazgos',
  trabajo_extra: '/terreno/trabajos-extra',
  // El aviso lo recibe solo el ADMIN, así que lleva a SU vista de reportes
  // (con filtros), no al formulario del supervisor en Terreno.
  reporte_diario: '/reportes-diarios',
};

export function rutaDeRegistroEditado(data: Notificacion['data']): string | null {
  const entity = data?.entity;
  return typeof entity === 'string' ? (RUTAS[entity] ?? null) : null;
}
