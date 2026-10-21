import { NOTIF_TIPOS, type Notificacion } from '../../types/notificacion';
import { ROLES, type Role } from '../../types/roles';

/**
 * Destinos de GESTIÓN por rol: al administrador cada aviso lo lleva a la vista
 * donde ese registro se gestiona —no a la ficha del equipo—:
 *
 * - `hallazgo.created` → `/hallazgos?id=…`, ESE hallazgo abierto en su detalle.
 * - `orden.completed` → `/mantenciones?id=…`, el detalle de la mantención.
 * - `item.low-stock` → `/inventario` (también para el supervisor, que puede
 *   revisar el stock desde el escritorio).
 *
 * `null` = este aviso no tiene destino de gestión para ese rol, y el item cae
 * al destino por defecto (la ficha del equipo si `data.equipoId` viene).
 */
export function rutaDeGestion(notificacion: Notificacion, role: Role | null): string | null {
  if (notificacion.tipo === NOTIF_TIPOS.HALLAZGO_CREATED && role === ROLES.ADMIN) {
    const hallazgoId = notificacion.data?.hallazgoId;
    return typeof hallazgoId === 'string' && hallazgoId.length > 0
      ? `/hallazgos?id=${encodeURIComponent(hallazgoId)}`
      : '/hallazgos';
  }

  if (notificacion.tipo === NOTIF_TIPOS.ORDEN_COMPLETED && role === ROLES.ADMIN) {
    const ordenId = notificacion.data?.ordenId;
    return typeof ordenId === 'string' && ordenId.length > 0
      ? `/mantenciones?id=${encodeURIComponent(ordenId)}`
      : '/mantenciones';
  }

  if (
    notificacion.tipo === NOTIF_TIPOS.ITEM_LOW_STOCK &&
    (role === ROLES.ADMIN || role === ROLES.SUPERVISOR)
  ) {
    return '/inventario';
  }

  return null;
}
