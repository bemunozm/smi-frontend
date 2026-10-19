import type { Notificacion } from '../../types/notificacion';
import { ROLES, type Role } from '../../types/roles';

/**
 * A dónde lleva un aviso del Módulo 4 (vencimientos): a la ficha del equipo,
 * que trae sus documentos y su calendario de vencimientos. El mantenedor entra
 * a la ficha del taller; con la mantención por km, a Órdenes (ahí está la
 * orden). Sin equipo en el aviso, al calendario de todos los livianos.
 *
 * `null` si el tipo no es de vencimientos.
 */
export function rutaDeVencimiento(notificacion: Notificacion, role: Role | null): string | null {
  const taller = role === ROLES.MANTENEDOR;
  const equipo = notificacion.data?.equipmentId;
  const base = taller ? '/mantenimiento/equipos' : '/equipos';
  const ficha = typeof equipo === 'string' && equipo ? `${base}/${encodeURIComponent(equipo)}` : null;
  if (notificacion.tipo === 'document.expiring') {
    return ficha ?? (taller ? '/mantenimiento/vencimientos' : '/equipos/vencimientos');
  }
  if (notificacion.tipo === 'light-service.due') {
    if (taller) return '/mantenimiento/ordenes';
    return ficha ?? '/equipos/vencimientos';
  }
  return null;
}
