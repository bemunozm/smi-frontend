import { ROLES, type Role } from '../types/roles';

export interface NavItem {
  label: string;
  to: string;
  /** Roles que ven este item en el menú. */
  roles: readonly Role[];
}

/**
 * Menú por rol. Los items que todavía apuntan a `PlaceholderView`
 * ("En construcción") son los dominios que aún no se implementan; Flota,
 * Inventario y Terreno ya llevan a su vista real. Lo que importa acá es que el
 * menú cambia según `session.user.role`.
 *
 * Los roles de cada item deben coincidir con los `allowedRoles` de la ruta en
 * `routes.tsx`: mostrar un item que después rebota en `/forbidden` es peor que
 * no mostrarlo.
 */
export const NAV_ITEMS: readonly NavItem[] = [
  {
    label: 'Dashboard',
    to: '/',
    roles: [ROLES.ADMIN, ROLES.SUPERVISOR, ROLES.MANTENEDOR, ROLES.OPERADOR],
  },
  {
    label: 'Equipos',
    to: '/equipos',
    roles: [ROLES.ADMIN, ROLES.SUPERVISOR, ROLES.MANTENEDOR],
  },
  {
    label: 'Inventario',
    to: '/inventario',
    roles: [ROLES.ADMIN, ROLES.SUPERVISOR, ROLES.MANTENEDOR],
  },
  { label: 'Terreno', to: '/terreno', roles: [ROLES.ADMIN, ROLES.SUPERVISOR] },
  { label: 'Mantenimiento', to: '/mantenimiento', roles: [ROLES.ADMIN, ROLES.MANTENEDOR] },
  { label: 'Notificaciones', to: '/notificaciones', roles: [ROLES.ADMIN] },
  { label: 'Reportes', to: '/reportes', roles: [ROLES.ADMIN] },
  { label: 'Usuarios', to: '/usuarios', roles: [ROLES.ADMIN] },
];
