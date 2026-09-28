import { ALL_ROLES, ROLES, type Role } from '../types/roles';

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
    // OPERADOR no tiene Dashboard ni pantallas de datos (ver plan
    // "Supervisión en Terreno", sección Roles; `config/home-path.ts` lo manda
    // a `/sin-modulos`) — la ruta `/` ya lo exige en `routes.tsx`, este item
    // tiene que coincidir o mostraría un link que rebota a `/forbidden`.
    roles: [ROLES.ADMIN, ROLES.SUPERVISOR, ROLES.MANTENEDOR],
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
  { label: 'Operadores', to: '/operadores', roles: [ROLES.ADMIN, ROLES.SUPERVISOR] },
  { label: 'Mantenimiento', to: '/mantenimiento', roles: [ROLES.ADMIN, ROLES.MANTENEDOR] },
  // Universal: todos los roles autenticados ven y usan notificaciones.
  { label: 'Notificaciones', to: '/notificaciones', roles: ALL_ROLES },
  { label: 'Reportes', to: '/reportes', roles: [ROLES.ADMIN] },
  { label: 'Usuarios', to: '/usuarios', roles: [ROLES.ADMIN] },
];
