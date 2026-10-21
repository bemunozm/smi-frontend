import { ROLES, type Role } from '../types/roles';

/** Cada lista que "Preparar para uso sin señal" deja en el caché del equipo. */
export const PREP_KEYS = [
  'dashboard',
  'equipment',
  'branches',
  'operators',
  'inventory',
  'movimientos',
  'maintenance',
  'bitacora',
  'dailyChecklists',
  'vencimientos',
  'notificaciones',
  'shiftCards',
  'hallazgos',
  'trabajosExtra',
  'reporteDiario',
  'horometro',
  'combustible',
] as const;
export type PrepKey = (typeof PREP_KEYS)[number];

/** Cuántas órdenes de trabajo (las más recientes) dejan su bitácora precargada: la
 * bitácora es una lectura por orden, y precargarlas todas serían cientos de requests. */
export const BITACORA_ORDENES_PRECARGADAS = 15;

/** Qué listas necesita cada pantalla para abrir sin señal:
 * las propias más las que sus formularios ofrecen en selectores. */
const PREP_BY_ROUTE: Readonly<Record<string, readonly PrepKey[]>> = {
  '/': ['dashboard'],
  '/equipos': ['equipment', 'branches', 'operators'],
  '/inventario': ['inventory', 'branches', 'movimientos'],
  '/operadores': ['operators'],
  // `dailyChecklists`: el mantenedor llena el checklist diario (M2) en el taller.
  // `vencimientos`: el calendario vive en `/mantenimiento/vencimientos` y
  // `/equipos/vencimientos` (ADMIN + MANTENEDOR — los roles que reciben los avisos).
  '/mantenimiento': ['maintenance', 'equipment', 'bitacora', 'dailyChecklists', 'vencimientos'],
  '/notificaciones': ['notificaciones'],
  // `dailyChecklists`: el supervisor valida los checklists (M3). `reporteDiario`:
  // los reportes de la semana y los catálogos (plantas, empresas externas) que
  // ofrece el formulario.
  '/terreno': [
    'equipment',
    'operators',
    'shiftCards',
    'hallazgos',
    'trabajosExtra',
    'reporteDiario',
    'dailyChecklists',
    'horometro',
    'combustible',
  ],
};

/**
 * Qué pantallas puede abrir cada rol — espejo de los `allowedRoles` de
 * `routes.tsx`, NO del menú (`NAV_ITEMS`): los shells de Terreno y Taller son
 * el home de SUPERVISOR/MANTENEDOR aunque no aparezcan en el menú, así que
 * sacar una entrada del menú no puede dejar a un rol sin sus listas en el
 * arranque sin señal. Si una ruta cambia de roles en `routes.tsx`, este mapa
 * se actualiza a mano (los tests de `offline-prep.test.ts` fijan el contrato).
 */
const RUTAS_POR_ROL: Readonly<Record<Role, readonly string[]>> = {
  [ROLES.ADMIN]: ['/', '/equipos', '/inventario', '/operadores', '/mantenimiento', '/terreno', '/notificaciones'],
  [ROLES.SUPERVISOR]: ['/equipos', '/inventario', '/operadores', '/terreno', '/notificaciones'],
  [ROLES.MANTENEDOR]: ['/equipos', '/inventario', '/mantenimiento', '/notificaciones'],
};

/** Sin rol reconocido (la barra de Terreno antes de resolver la sesión) se prepara
 * lo que Terreno necesita, que es lo único que ahí se muestra. */
const SIN_ROL: readonly PrepKey[] = PREP_BY_ROUTE['/terreno'] ?? [];

/**
 * Las listas a precargar para un rol: la unión de lo que necesitan las pantallas
 * que ese rol puede abrir (`RUTAS_POR_ROL`) — así un rol nunca precarga lo que
 * no puede abrir ni se queda sin lo que usa.
 */
export function prepKeysFor(role: Role | null | undefined): readonly PrepKey[] {
  if (!role) return PREP_KEYS.filter((key) => SIN_ROL.includes(key));
  const keys = new Set<PrepKey>();
  for (const ruta of RUTAS_POR_ROL[role] ?? []) {
    for (const key of PREP_BY_ROUTE[ruta] ?? []) keys.add(key);
  }
  return PREP_KEYS.filter((key) => keys.has(key));
}
