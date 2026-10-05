import type { AssignEquipmentInput, EquipmentAssignee } from '../types/equipment';

/**
 * `null` (sin sucursal/asignar) no es un `id` válido para `Select` de
 * HeroUI — sentinels para los pickers de asignación de equipo, compartidos
 * por `EquiposView` (`CreateEquipoModal`), `EquipoDetalleView` (`AsignacionForm`)
 * y `EquipoEditDelete` (`CamposEquipo`/`EditEquipoModal`).
 */
export const SIN_SUCURSAL = '__sin_sucursal__';
export const SIN_ASIGNAR = '__sin_asignar__';

/** Resuelve el sentinel del picker al id real (o `null`) que espera
 * `AssignEquipmentInput`. */
export function idDesdeSentinel(value: string): string | null {
  return value === SIN_ASIGNAR ? null : value;
}

/**
 * Compara lo elegido en los pickers de operador/supervisor (sentinels de
 * `idDesdeSentinel`) contra la asignación ACTUAL del equipo y arma el body
 * PARCIAL que espera `PATCH /equipment/:id/assignment` — cada clave se manda
 * SOLO si de verdad cambió.
 *
 * Mandar SIEMPRE las dos claves (como se hacía antes) hacía que el backend
 * revalidara con `OperatorsService.assertActive`/`assertSupervisor` un campo
 * que el usuario nunca tocó: si el operador ya asignado se había desactivado
 * mientras tanto, guardar un cambio de SOLO el supervisor fallaba con 409
 * `OPERATOR_INACTIVE` sobre un campo intacto. Ahora cada clave se omite
 * (`undefined`, "sin cambios") salvo que el id elegido difiera del actual —
 * `null` explícito (liberar) SIGUE viajando siempre que el usuario lo
 * eligió, porque ahí sí cambió respecto de lo que había.
 */
export function buildAssignmentDiff(
  equipoActual: { operator: EquipmentAssignee | null; supervisor: EquipmentAssignee | null },
  operatorId: string,
  supervisorId: string,
): AssignEquipmentInput {
  const operatorIdFinal = idDesdeSentinel(operatorId);
  const supervisorIdFinal = idDesdeSentinel(supervisorId);
  const diff: AssignEquipmentInput = {};
  if (operatorIdFinal !== (equipoActual.operator?.id ?? null)) {
    diff.operatorId = operatorIdFinal;
  }
  if (supervisorIdFinal !== (equipoActual.supervisor?.id ?? null)) {
    diff.supervisorId = supervisorIdFinal;
  }
  return diff;
}
