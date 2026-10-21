import { ALL_ROLES, ROLES, type Role } from '../types/roles';

export interface NavItem {
  label: string;
  to: string;
  /** Roles que ven este item en el menú. */
  roles: readonly Role[];
}

/**
 * Menú por rol. Los items que todavía apuntan a `PlaceholderView`
 * ("En construcción") son los dominios que aún no se implementan. Lo que
 * importa acá es que el menú cambia según `session.user.role`.
 *
 * Los roles de cada item deben coincidir con los `allowedRoles` de la ruta en
 * `routes.tsx`: mostrar un item que después rebota en `/forbidden` es peor que
 * no mostrarlo.
 */
export const NAV_ITEMS: readonly NavItem[] = [
  {
    label: 'Dashboard',
    to: '/',
    // Solo ADMIN: el dashboard consulta `/api/dashboard/*` (403 para el resto).
    // SUPERVISOR/MANTENEDOR tienen su propio home (ver `config/home-path.ts`).
    roles: [ROLES.ADMIN],
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
  // Terreno y Mantenimiento NO van en este menú (pedido del administrador):
  // son shells propios a los que cada rol entra como su home (ver
  // `config/home-path.ts`); las rutas siguen vivas para quien navegue directo.
  // Gestión de hallazgos (corregir/eliminar) — vista del administrador, no la de Terreno.
  { label: 'Hallazgos', to: '/hallazgos', roles: [ROLES.ADMIN] },
  // Trabajos extraordinarios con filtros — vista del administrador, no la de Terreno.
  { label: 'Trabajos extra', to: '/trabajos-extra', roles: [ROLES.ADMIN] },
  // Reportes diarios de los supervisores — vista del administrador, no la de Terreno.
  { label: 'Reportes diarios', to: '/reportes-diarios', roles: [ROLES.ADMIN] },
  // Registro de mantenciones completadas del taller — vista del administrador.
  { label: 'Mantenciones', to: '/mantenciones', roles: [ROLES.ADMIN] },
  { label: 'Operadores', to: '/operadores', roles: [ROLES.ADMIN, ROLES.SUPERVISOR] },
  // Universal: todos los roles autenticados ven y usan notificaciones.
  { label: 'Notificaciones', to: '/notificaciones', roles: ALL_ROLES },
  { label: 'Reportes', to: '/reportes', roles: [ROLES.ADMIN] },
  { label: 'Usuarios', to: '/usuarios', roles: [ROLES.ADMIN] },
];
