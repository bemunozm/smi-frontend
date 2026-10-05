import type { Role } from '../types/roles';
import { NAV_ITEMS } from './nav-items';

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
  'notificaciones',
  'shiftCards',
  'hallazgos',
  'trabajosExtra',
  'horometro',
  'combustible',
] as const;
export type PrepKey = (typeof PREP_KEYS)[number];

/** Cuántas órdenes de trabajo (las más recientes) dejan su bitácora precargada: la
 * bitácora es una lectura por orden, y precargarlas todas serían cientos de requests. */
export const BITACORA_ORDENES_PRECARGADAS = 15;

/** Qué listas necesita cada pantalla del menú (`NAV_ITEMS`) para abrir sin señal:
 * las propias más las que sus formularios ofrecen en selectores. */
const PREP_BY_ROUTE: Readonly<Record<string, readonly PrepKey[]>> = {
  '/': ['dashboard'],
  '/equipos': ['equipment', 'branches', 'operators'],
  '/inventario': ['inventory', 'branches', 'movimientos'],
  '/operadores': ['operators'],
  '/mantenimiento': ['maintenance', 'equipment', 'bitacora'],
  '/notificaciones': ['notificaciones'],
  '/terreno': ['equipment', 'operators', 'shiftCards', 'hallazgos', 'trabajosExtra', 'horometro', 'combustible'],
};

/** Sin rol reconocido (la barra de Terreno antes de resolver la sesión) se prepara
 * lo que Terreno necesita, que es lo único que ahí se muestra. */
const SIN_ROL: readonly PrepKey[] = PREP_BY_ROUTE['/terreno'] ?? [];

/**
 * Las listas a precargar para un rol: la unión de lo que necesitan las pantallas
 * que ese rol ve en el menú — la misma fuente que el `Sidebar` y el `BottomNav`,
 * así que un rol nunca precarga lo que no puede abrir ni se queda sin lo que usa.
 */
export function prepKeysFor(role: Role | null | undefined): readonly PrepKey[] {
  if (!role) return SIN_ROL;
  const keys = new Set<PrepKey>();
  for (const item of NAV_ITEMS) {
    if (!item.roles.includes(role)) continue;
    for (const key of PREP_BY_ROUTE[item.to] ?? []) keys.add(key);
  }
  return PREP_KEYS.filter((key) => keys.has(key));
}
