import type { Notificacion } from '../../types/notificacion';
import { ROLES, type Role } from '../../types/roles';

/**
 * A dónde lleva un aviso del checklist diario (Módulo 2 y 3):
 *
 * - `checklist.submitted` → al supervisor, a validarlo en Terreno.
 * - `checklist.reviewed` → al mantenedor: si lo rechazaron, directo a
 *   corregirlo; si lo aceptaron, a su pantalla. Al administrador, al detalle
 *   en Terreno (solo lectura).
 *
 * `null` si el payload no trae el checklist.
 */
export function rutaDeChecklist(notificacion: Notificacion, role: Role | null): string | null {
  const id = notificacion.data?.checklistId;
  if (typeof id !== 'string' || id.length === 0) return null;
  if (notificacion.tipo === 'checklist.reviewed' && role === ROLES.MANTENEDOR) {
    return notificacion.data?.decision === 'REJECTED'
      ? `/mantenimiento/checklist?corregir=${encodeURIComponent(id)}`
      : '/mantenimiento/checklist';
  }
  return `/terreno/checklists?id=${encodeURIComponent(id)}`;
}
