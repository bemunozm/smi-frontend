import type { EndpointKey } from '../offline/endpoints';
import { ROLES, type Role } from '../types/roles';

const { ADMIN, SUPERVISOR, MANTENEDOR } = ROLES;

/**
 * Quién puede hacer cada escritura: espejo de los `@Roles` del backend
 * (los controllers de `smi-backend`). El backend sigue siendo quien decide;
 * esto existe para no ofrecer en pantalla lo que va a rechazar siempre: sin
 * señal esa acción se encola, el servidor responde 403 horas después y queda
 * esperando en la hoja de sincronización sin que se pueda reintentar con éxito.
 *
 * Es un `Record` sobre todas las claves del registro de escrituras: agregar una
 * escritura nueva sin decidir su rol no compila.
 */
export const WRITE_ROLES: Record<EndpointKey, readonly Role[]> = {
  // Flota
  'equipment.create': [ADMIN],
  'equipment.update': [ADMIN],
  'equipment.status': [ADMIN, SUPERVISOR],
  'equipment.assign': [ADMIN, SUPERVISOR],
  'equipment.delete': [ADMIN],
  'equipmentDocument.create': [ADMIN, SUPERVISOR],
  'equipmentDocument.update': [ADMIN, SUPERVISOR],
  'equipmentDocument.delete': [ADMIN, SUPERVISOR],
  'horometro.create': [ADMIN, SUPERVISOR],
  'horometro.close': [ADMIN, SUPERVISOR],
  'combustible.create': [ADMIN, SUPERVISOR],
  // Inventario
  'item.create': [ADMIN],
  'item.update': [ADMIN],
  'item.delete': [ADMIN],
  'item.adjust': [ADMIN],
  'item.setMinimum': [ADMIN, MANTENEDOR],
  'movement.create': [ADMIN, MANTENEDOR],
  'stock.transfer': [ADMIN, SUPERVISOR],
  'category.create': [ADMIN],
  'category.update': [ADMIN],
  'category.delete': [ADMIN],
  // Mantenimiento
  'orden.create': [ADMIN, SUPERVISOR],
  'orden.update': [ADMIN, SUPERVISOR, MANTENEDOR],
  'orden.toggleTarea': [ADMIN, SUPERVISOR, MANTENEDOR],
  'intervencion.create': [MANTENEDOR],
  'actividad.create': [ADMIN, SUPERVISOR],
  'actividad.update': [ADMIN, SUPERVISOR, MANTENEDOR],
  'umbral.create': [ADMIN],
  'maintenancePlan.save': [ADMIN, MANTENEDOR],
  // Catálogos
  'branch.create': [ADMIN, SUPERVISOR],
  'branch.update': [ADMIN, SUPERVISOR],
  'branch.delete': [ADMIN],
  'operator.create': [ADMIN, SUPERVISOR],
  'operator.update': [ADMIN, SUPERVISOR],
  'operator.delete': [ADMIN],
  // Terreno
  'shiftCard.edit': [ADMIN, SUPERVISOR],
  'hallazgo.edit': [ADMIN, SUPERVISOR],
  'trabajoExtra.edit': [ADMIN, SUPERVISOR],
};

/** `true` si `role` puede hacer la escritura `action`. Sin rol (sesión sin
 * resolver) no se ofrece nada. */
export function canWrite(role: Role | null | undefined, action: EndpointKey): boolean {
  return role != null && WRITE_ROLES[action].includes(role);
}

/** `true` si `role` puede hacer al menos una de las escrituras de `actions`. */
export function canWriteAny(role: Role | null | undefined, actions: readonly EndpointKey[]): boolean {
  return actions.some((action) => canWrite(role, action));
}

/**
 * Cerrar la tarjeta de un turno que se abrió en Registro de turno (`shiftId`
 * del turno abierto del equipo): desde Flota solo el administrador. El servidor
 * responde siempre 409 `SHIFT_CARD_CLOSE_ELSEWHERE` al resto; la cierra el
 * supervisor desde Terreno (`horometro.service.ts#close`).
 */
export function canCloseShiftCardFromFleet(role: Role | null | undefined): boolean {
  return role === ADMIN;
}

/** Los cuatro modos del formulario de movimiento de un ítem. */
export type MovementMode = 'in' | 'out' | 'transfer' | 'count';

/** Qué escritura exige cada modo: el backend rechaza al resto con 403. */
export const MOVEMENT_MODE_ACTIONS = {
  in: 'movement.create',
  out: 'movement.create',
  transfer: 'stock.transfer',
  count: 'item.adjust',
} as const satisfies Record<MovementMode, EndpointKey>;

/** Las escrituras de stock de un ítem: la pantalla ofrece "Registrar movimiento"
 * si el rol puede hacer al menos una (cada modo exige la suya). */
export const MOVEMENT_ACTIONS = ['movement.create', 'stock.transfer', 'item.adjust'] as const satisfies readonly EndpointKey[];
