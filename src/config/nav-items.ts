import { ALL_ROLES, ROLES, type Role } from '../types/roles';

/** Secciones del menú lateral, en el orden en que se pintan. */
export const NAV_SECCIONES = ['Administración', 'Reportes', 'Usuarios'] as const;
export type NavSeccion = (typeof NAV_SECCIONES)[number];

export interface NavItem {
  label: string;
  to: string;
  /** Roles que ven este item en el menú. */
  roles: readonly Role[];
  /** Grupo bajo cuyo título aparece en el `Sidebar`. Una sección sin items
   * visibles para el rol no muestra su título. */
  seccion: NavSeccion;
}

/**
 * Menú por rol, agrupado en secciones (pedido del administrador):
 * Administración (la operación diaria), Reportes (los registros que él
 * gestiona y revisa) y Usuarios (personas y avisos). Lo que importa acá es
 * que el menú cambia según `session.user.role`.
 *
 * Los roles de cada item deben coincidir con los `allowedRoles` de la ruta en
 * `routes.tsx`: mostrar un item que después rebota en `/forbidden` es peor que
 * no mostrarlo.
 *
 * Terreno y Mantenimiento NO van en este menú (pedido del administrador):
 * son shells propios a los que cada rol entra como su home (ver
 * `config/home-path.ts`); las rutas siguen vivas para quien navegue directo.
 */
export const NAV_ITEMS: readonly NavItem[] = [
  // --- Administración -------------------------------------------------------
  {
    label: 'Dashboard',
    to: '/',
    // Solo ADMIN: el dashboard consulta `/api/dashboard/*` (403 para el resto).
    // SUPERVISOR/MANTENEDOR tienen su propio home (ver `config/home-path.ts`).
    roles: [ROLES.ADMIN],
    seccion: 'Administración',
  },
  {
    label: 'Equipos',
    to: '/equipos',
    roles: [ROLES.ADMIN, ROLES.SUPERVISOR, ROLES.MANTENEDOR],
    seccion: 'Administración',
  },
  {
    label: 'Inventario',
    to: '/inventario',
    roles: [ROLES.ADMIN, ROLES.SUPERVISOR, ROLES.MANTENEDOR],
    seccion: 'Administración',
  },
  // --- Reportes (vistas del administrador, no las de Terreno) ---------------
  { label: 'Reportes', to: '/reportes', roles: [ROLES.ADMIN], seccion: 'Reportes' },
  // Reportes diarios de los supervisores.
  { label: 'Reportes diarios', to: '/reportes-diarios', roles: [ROLES.ADMIN], seccion: 'Reportes' },
  // Gestión de hallazgos (corregir/eliminar/crear).
  { label: 'Hallazgos', to: '/hallazgos', roles: [ROLES.ADMIN], seccion: 'Reportes' },
  // Trabajos extraordinarios con filtros.
  { label: 'Trabajos extra', to: '/trabajos-extra', roles: [ROLES.ADMIN], seccion: 'Reportes' },
  // Registro de mantenciones completadas del taller.
  { label: 'Mantenciones', to: '/mantenciones', roles: [ROLES.ADMIN], seccion: 'Reportes' },
  // --- Usuarios --------------------------------------------------------------
  { label: 'Operadores', to: '/operadores', roles: [ROLES.ADMIN, ROLES.SUPERVISOR], seccion: 'Usuarios' },
  { label: 'Usuarios', to: '/usuarios', roles: [ROLES.ADMIN], seccion: 'Usuarios' },
  // Universal: todos los roles autenticados ven y usan notificaciones.
  { label: 'Notificaciones', to: '/notificaciones', roles: ALL_ROLES, seccion: 'Usuarios' },
];
