import { ROLES, type Role } from '../types/roles';

/**
 * Ruta de aterrizaje por rol — única fuente de verdad consumida por
 * `LoginView`, `GuestRoute`, `HomeRedirect` (ruta `/inicio`) y el
 * `start_url` del manifest PWA (ver `vite.config.ts`):
 * - SUPERVISOR entra directo a Terreno (su única pantalla de trabajo);
 * - MANTENEDOR, directo al taller (`/mantenimiento`) — su módulo es ese, no
 *   el panel de escritorio, igual que el supervisor con Terreno;
 * - ADMIN, al dashboard de escritorio.
 *
 * `role: null` (sesión sin rol reconocido — incluye un rol que YA NO EXISTE:
 * el catálogo `Operator` es un CRUD aparte, sin acceso a la plataforma, así
 * que ya no hay un rol "sin módulos" que aterrizar) cae al dashboard, igual
 * que ADMIN — `ProtectedRoute` lo termina de filtrar si no corresponde, así
 * nunca queda dando vueltas: entra directo a `/forbidden` (nunca un loop,
 * ver `home-path.test.ts`).
 */
export function homePathFor(role: Role | null): string {
  switch (role) {
    case ROLES.SUPERVISOR:
      return '/terreno/registro';
    case ROLES.MANTENEDOR:
      return '/mantenimiento/ordenes';
    case ROLES.ADMIN:
      return '/';
    default:
      return '/';
  }
}
