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
    // ADMIN y SECRETARIA: el dashboard consulta `/api/dashboard/*` (403 para
    // el resto). SUPERVISOR/MANTENEDOR tienen su propio home (ver
    // `config/home-path.ts`).
    roles: [ROLES.ADMIN, ROLES.SECRETARIA],
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
  // Para registrar el uso de la camioneta que tenga asignada (km de salida y
  // carga de combustible). El mantenedor y el prevencionista la tienen en su
  // propio shell; el administrador no entra al taller, así que va acá.
  { label: 'Mi camioneta', to: '/mi-camioneta', roles: [ROLES.ADMIN], seccion: 'Administración' },
  // --- Reportes (vistas del administrador, no las de Terreno) ---------------
  // Reportes de salida de turno (equipos usados en el día, por supervisor).
  { label: 'Informe diario equipos', to: '/reportes', roles: [ROLES.ADMIN, ROLES.SECRETARIA], seccion: 'Reportes' },
  // Reportes diarios de producción de los supervisores.
  { label: 'Informe de producción diaria', to: '/reportes-diarios', roles: [ROLES.ADMIN, ROLES.SECRETARIA], seccion: 'Reportes' },
  // Gestión de hallazgos (corregir/eliminar/crear).
  { label: 'Hallazgos', to: '/hallazgos', roles: [ROLES.ADMIN, ROLES.SECRETARIA], seccion: 'Reportes' },
  // Trabajos extraordinarios con filtros (renombrado «Report» a pedido del
  // administrador — las rutas y el dominio conservan el nombre viejo).
  { label: 'Report', to: '/trabajos-extra', roles: [ROLES.ADMIN, ROLES.SECRETARIA], seccion: 'Reportes' },
  // Todas las cargas de combustible (cierres de tarjeta + altas manuales),
  // con filtros y alta manual para livianos y pesados.
  { label: 'Cargas de combustible', to: '/cargas-combustible', roles: [ROLES.ADMIN, ROLES.SECRETARIA], seccion: 'Reportes' },
  // Registro de mantenciones completadas del taller.
  { label: 'Mantenciones', to: '/mantenciones', roles: [ROLES.ADMIN, ROLES.SECRETARIA], seccion: 'Reportes' },
  // Grilla mensual de días trabajados (supervisores + operadores), derivada
  // de tarjetas y Reports — la hoja «DIAS TRABAJO MES» de la secretaria.
  { label: 'Asistencia', to: '/asistencia', roles: [ROLES.ADMIN, ROLES.SECRETARIA], seccion: 'Reportes' },
  // Línea de tiempo de TODO lo que se registra (cargas, tarjetas, reportes,
  // Reports, hallazgos, mantenimiento, ediciones y eliminaciones), con el día
  // en que se hizo y el día al que corresponde el dato.
  { label: 'Registro de actividad', to: '/registro-actividad', roles: [ROLES.ADMIN, ROLES.SECRETARIA], seccion: 'Reportes' },
  // --- Usuarios --------------------------------------------------------------
  { label: 'Operadores', to: '/operadores', roles: [ROLES.ADMIN, ROLES.SUPERVISOR], seccion: 'Usuarios' },
  { label: 'Usuarios', to: '/usuarios', roles: [ROLES.ADMIN], seccion: 'Usuarios' },
  // Universal: todos los roles autenticados ven y usan notificaciones.
  { label: 'Notificaciones', to: '/notificaciones', roles: ALL_ROLES, seccion: 'Usuarios' },
];
