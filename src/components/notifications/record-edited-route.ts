import type { Notificacion } from '../../types/notificacion';

/** A dónde lleva el aviso de un registro corregido: la pantalla donde el
 * administrador ve ese registro y su historial de cambios. `null` si el payload
 * no trae una entidad conocida. */
const RUTAS: Record<string, string> = {
  shift_card: '/terreno/registro',
  hallazgo: '/terreno/hallazgos',
  trabajo_extra: '/terreno/trabajos-extra',
};

export function rutaDeRegistroEditado(data: Notificacion['data']): string | null {
  const entity = data?.entity;
  return typeof entity === 'string' ? (RUTAS[entity] ?? null) : null;
}
