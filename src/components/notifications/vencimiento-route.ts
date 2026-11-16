import type { Notificacion } from '../../types/notificacion';
import { ROLES, type Role } from '../../types/roles';

/**
 * A dónde lleva un aviso del Módulo 4 (vencimientos): a la ficha del equipo,
 * que trae sus documentos y su calendario de vencimientos. El mantenedor entra
 * a la ficha del taller; con la mantención por km o la preventiva de pauta, a
 * Órdenes (ahí está la orden). Al administrador la preventiva lo lleva al
 * detalle de esa mantención en su vista de gestión (como `orden.completed` en
 * `gestion-route.ts`). Sin equipo en el aviso, al calendario de los livianos.
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
  if (notificacion.tipo === 'preventive-service.due') {
    if (taller) return '/mantenimiento/ordenes';
    const ordenId = notificacion.data?.ordenId;
    if (typeof ordenId === 'string' && ordenId) return `/mantenciones?id=${encodeURIComponent(ordenId)}`;
    return ficha ?? '/mantenciones';
  }
  return null;
}
