import { ROLES, type Role } from '../types/roles';

/**
 * Ruta de aterrizaje por rol — única fuente de verdad consumida por
 * `LoginView`, `GuestRoute`, `HomeRedirect` (ruta `/inicio`) y el
 * `start_url` del manifest PWA (ver `vite.config.ts`). Ver plan "Supervisión
 * en Terreno", sección "Diseño → Roles (frontend)":
 * - SUPERVISOR entra directo a Terreno (su única pantalla de trabajo);
 * - ADMIN/MANTENEDOR, al dashboard de escritorio.
 *
 * `role: null` (sesión sin rol reconocido — incluye un rol que YA NO EXISTE:
 * el catálogo `Operator` es un CRUD aparte, sin acceso a la plataforma, así
 * que ya no hay un rol "sin módulos" que aterrizar) cae al dashboard, igual que
 * ADMIN/MANTENEDOR — `ProtectedRoute` lo termina de filtrar si no
 * corresponde, así nunca queda dando vueltas: entra directo a `/forbidden`
 * (nunca un loop, ver `home-path.test.ts`).
 */
export function homePathFor(role: Role | null): string {
  switch (role) {
    case ROLES.SUPERVISOR:
      return '/terreno/registro';
    case ROLES.ADMIN:
    case ROLES.MANTENEDOR:
      return '/';
    default:
      return '/';
  }
}
