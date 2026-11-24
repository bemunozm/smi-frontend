import type { EndpointKey } from '../offline/endpoints';
import { ROLES, type Role } from '../types/roles';

const { ADMIN, SUPERVISOR, MANTENEDOR, SECRETARIA } = ROLES;

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
  // SECRETARIA opera Flota (equipos, estado, asignación, documentos, pauta y
  // horómetro) y crea/edita artículos (pedido del cliente 20/11/2026);
  // eliminar equipos/artículos y los movimientos de stock siguen sin ella.
  'equipment.create': [ADMIN, SECRETARIA],
  'equipment.update': [ADMIN, SECRETARIA],
  'equipment.status': [ADMIN, SUPERVISOR, SECRETARIA],
  'equipment.assign': [ADMIN, SUPERVISOR, SECRETARIA],
  'equipment.delete': [ADMIN],
  // Módulo 4: los documentos los cargaban solo el administrador (decisión de
  // Joaquín, 19/10); desde el 20/11 también SECRETARIA. Los avisos siguen
  // llegando a mantenedor y administrador.
  'equipmentDocument.create': [ADMIN, SECRETARIA],
  'equipmentDocument.update': [ADMIN, SECRETARIA],
  'equipmentDocument.delete': [ADMIN, SECRETARIA],
  'horometro.create': [ADMIN, SUPERVISOR, SECRETARIA],
  'horometro.close': [ADMIN, SUPERVISOR, SECRETARIA],
  // SECRETARIA registra la carga que un supervisor olvidó — mismo criterio
  // que trabajos extra y hallazgos (espejo del @Roles del backend).
  'combustible.create': [ADMIN, SUPERVISOR, SECRETARIA],
  // Inventario
  'item.create': [ADMIN, SECRETARIA],
  'item.update': [ADMIN, SECRETARIA],
  // Dar de baja o reactivar un ítem (PATCH /items/:id/active): ADMIN y SECRETARIA.
  'item.setActive': [ADMIN, SECRETARIA],
  // Asignar o quitar los equipos de un ítem (PUT /items/:id/compatibilities).
  'itemCompatibility.save': [ADMIN, SECRETARIA],
  'item.delete': [ADMIN],
  'item.adjust': [ADMIN],
  'item.setMinimum': [ADMIN, MANTENEDOR],
  'movement.create': [ADMIN, MANTENEDOR],
  'stock.transfer': [ADMIN, SUPERVISOR],
  'category.create': [ADMIN],
  'category.update': [ADMIN],
  'category.delete': [ADMIN],
  // Mantenimiento
  // MANTENEDOR incluido: el taller inicia operaciones desde los hallazgos de
  // su bandeja (la OT nace ligada y el hallazgo pasa a EN_PROCESO).
  'orden.create': [ADMIN, SUPERVISOR, MANTENEDOR],
  // SECRETARIA: corrige y cierra la orden que el taller olvidó.
  'orden.update': [ADMIN, SUPERVISOR, MANTENEDOR, SECRETARIA],
  'orden.toggleTarea': [ADMIN, SUPERVISOR, MANTENEDOR],
  // ADMIN incluido: puede cerrar una tarea del taller (registrar el cierre
  // con insumos/foto), además del MANTENEDOR que la trabaja.
  // SECRETARIA: solo el «qué se hizo» al cerrar, sin insumos (el backend se
  // los rechaza; el stock lo descuenta el taller).
  'intervencion.create': [ADMIN, MANTENEDOR, SECRETARIA],
  'actividad.create': [ADMIN, SUPERVISOR],
  'actividad.update': [ADMIN, SUPERVISOR, MANTENEDOR],
  'umbral.create': [ADMIN],
  'maintenancePlan.save': [ADMIN, MANTENEDOR, SECRETARIA],
  // «Asignar mantenciones» de un liviano: los mismos que guardan la pauta.
  'lightVehicleConfig.save': [ADMIN, MANTENEDOR, SECRETARIA],
  'maintenanceRecord.set': [MANTENEDOR],
  'dailyChecklist.submit': [MANTENEDOR],
  'dailyChecklist.resubmit': [MANTENEDOR],
  // Módulo 3: valida el supervisor, que es quien prueba el equipo en terreno.
  'dailyChecklist.review': [SUPERVISOR],
  // Catálogos
  'branch.create': [ADMIN, SUPERVISOR],
  'branch.update': [ADMIN, SUPERVISOR],
  'branch.delete': [ADMIN],
  'operator.create': [ADMIN, SUPERVISOR],
  'operator.update': [ADMIN, SUPERVISOR],
  'operator.delete': [ADMIN],
  // Terreno
  'shiftCard.edit': [ADMIN, SUPERVISOR],
  // SECRETARIA completa y corrige lo que un supervisor olvidó (pedido del
  // cliente, 03/11).
  'hallazgo.edit': [ADMIN, SUPERVISOR, SECRETARIA],
  'trabajoExtra.edit': [ADMIN, SUPERVISOR, SECRETARIA],
  'reporteDiario.create': [ADMIN, SUPERVISOR, SECRETARIA],
  'reporteDiario.edit': [ADMIN, SUPERVISOR, SECRETARIA],
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

/** Eliminar un hallazgo: `DELETE /api/hallazgos/:id` es solo ADMIN. */
export function canDeleteHallazgo(role: Role | null | undefined): boolean {
  return role === ADMIN;
}

/**
 * Corregir una carga de combustible ya registrada (típico: litros mal leídos
 * del display del surtidor): `PATCH /api/combustible/:id` es solo ADMIN, y la
 * corrección de una carga de tarjeta edita la tarjeta, también de ADMIN en el
 * panel. No vive en `WRITE_ROLES` porque esta escritura es online directa, no
 * una clave del registro del outbox.
 */
export function canEditCombustible(role: Role | null | undefined): boolean {
  return role === ADMIN;
}

/** Eliminar una carga (registro basura confirmado — duplicado, prueba):
 * `DELETE /api/combustible/:id` es solo ADMIN y deja traza en el historial. */
export function canDeleteCombustible(role: Role | null | undefined): boolean {
  return role === ADMIN;
}

/** Eliminar un report (trabajo extra): `DELETE /api/trabajos-extra/:id` es
 * solo ADMIN — mismo criterio que los hallazgos. */
export function canDeleteTrabajoExtra(role: Role | null | undefined): boolean {
  return role === ADMIN;
}

/** Eliminar un reporte de producción diaria: `DELETE /api/reporte-diario/:id`
 * es solo ADMIN — mismo criterio que los trabajos extra. */
export function canDeleteReporteDiario(role: Role | null | undefined): boolean {
  return role === ADMIN;
}

/** Eliminar un envío del Informe diario equipos (reporte de salida
 * duplicado): `DELETE /api/shift-reports/:id` es solo ADMIN. */
export function canDeleteShiftReport(role: Role | null | undefined): boolean {
  return role === ADMIN;
}

/** Eliminar una operación del taller pendiente o en proceso:
 * `DELETE /api/mantenimiento/ordenes/:id` es ADMIN y MANTENEDOR (17/11/2026). */
export function canDeleteOrden(role: Role | null | undefined): boolean {
  return role === ADMIN || role === MANTENEDOR;
}

/**
 * Pantallas que SECRETARIA puede abrir — espejo de sus `allowedRoles` en
 * `routes.tsx`. Lo usan los atajos del dashboard («Ver todo», la ficha de un
 * equipo) para no llevarla a una pantalla que la rebota a `/forbidden`.
 * Para el resto de los roles el dashboard no cambia.
 */
const RUTAS_SECRETARIA = [
  '/',
  '/reportes',
  '/chequeos-diarios',
  '/reportes-diarios',
  '/hallazgos',
  '/trabajos-extra',
  '/cargas-combustible',
  '/mantenciones',
  '/asistencia',
  '/equipos',
  '/inventario',
  '/notificaciones',
  '/perfil',
];

export function canOpenPath(role: Role | null | undefined, path: string): boolean {
  if (role !== SECRETARIA) return true;
  const base = path.split('?')[0];
  return RUTAS_SECRETARIA.some((ruta) => base === ruta || (ruta !== '/' && base.startsWith(`${ruta}/`)));
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
export const MOVEMENT_ACTIONS = [
  'movement.create',
  'stock.transfer',
  'item.adjust',
] as const satisfies readonly EndpointKey[];
