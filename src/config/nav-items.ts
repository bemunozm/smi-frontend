import { ROLES, type Role } from '../types/roles';

export interface NavItem {
  label: string;
  to: string;
  /** Roles que ven este item en el menú. */
  roles: readonly Role[];
}

/**
 * Menú por rol. Los módulos de dominio todavía no existen — cada item
 * apunta a una página placeholder ("En construcción"); lo que importa acá
 * es demostrar que el menú cambia según `session.user.role`.
 */
export const NAV_ITEMS: readonly NavItem[] = [
  {
    label: 'Dashboard',
    to: '/',
    roles: [ROLES.ADMIN, ROLES.SUPERVISOR, ROLES.MANTENEDOR, ROLES.OPERADOR],
  },
  { label: 'Equipos', to: '/equipos', roles: [ROLES.ADMIN] },
  { label: 'Inventario', to: '/inventario', roles: [ROLES.ADMIN] },
  { label: 'Terreno', to: '/terreno', roles: [ROLES.ADMIN, ROLES.SUPERVISOR] },
  { label: 'Mantenimiento', to: '/mantenimiento', roles: [ROLES.ADMIN, ROLES.MANTENEDOR] },
  { label: 'Notificaciones', to: '/notificaciones', roles: [ROLES.ADMIN] },
  { label: 'Reportes', to: '/reportes', roles: [ROLES.ADMIN] },
  { label: 'Usuarios', to: '/usuarios', roles: [ROLES.ADMIN] },
];
