/**
 * Roles del sistema SMI — espejo de `smi-backend/src/auth/roles.ts`.
 *
 * `smi-frontend` y `smi-backend` son repos git independientes, así que no
 * hay import cruzado posible: esta es la fuente única de verdad de roles
 * del lado del frontend. Si el backend agrega/renombra un rol, este archivo
 * debe actualizarse a mano.
 */
export const ROLES = {
  ADMIN: 'ADMIN',
  SUPERVISOR: 'SUPERVISOR',
  MANTENEDOR: 'MANTENEDOR',
  OPERADOR: 'OPERADOR',
} as const;

export type Role = (typeof ROLES)[keyof typeof ROLES];

export const ALL_ROLES: readonly Role[] = Object.values(ROLES);

/**
 * Type guard para angostar el `role` que llega desde Better Auth
 * (tipado como `string | null | undefined` — el plugin admin lo declara
 * opcional y el campo es nullable a nivel de esquema) a nuestro union
 * `Role`, sin recurrir a `any`/`as`.
 */
export function isRole(value: string | null | undefined): value is Role {
  return value != null && (ALL_ROLES as readonly string[]).includes(value);
}
