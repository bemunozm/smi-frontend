import { ROLES, type Role } from '../types/roles';

/** Colores semánticos de HeroUI (Chip/Avatar) aceptados para cada rol. */
export type RoleChipColor = 'accent' | 'success' | 'warning' | 'default';

const ROLE_CHIP_COLOR: Record<Role, RoleChipColor> = {
  [ROLES.ADMIN]: 'accent',
  [ROLES.SUPERVISOR]: 'success',
  [ROLES.MANTENEDOR]: 'warning',
  [ROLES.OPERADOR]: 'default',
};

/** Color de Chip/Avatar consistente por rol, reusado en Topbar y Usuarios. */
export function roleChipColor(role: Role): RoleChipColor {
  return ROLE_CHIP_COLOR[role];
}

export const ROLE_LABELS: Record<Role, string> = {
  [ROLES.ADMIN]: 'Administrador',
  [ROLES.SUPERVISOR]: 'Supervisor',
  [ROLES.MANTENEDOR]: 'Mantenedor',
  [ROLES.OPERADOR]: 'Operador',
};

/** Opciones `{value,label}` para selects de rol (crear/editar usuario). */
export const ROLE_OPTIONS: ReadonlyArray<{ value: Role; label: string }> = (
  Object.values(ROLES) as Role[]
).map((role) => ({ value: role, label: ROLE_LABELS[role] }));
