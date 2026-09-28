import { ROLES, type Role } from '../types/roles';

/** Home de OPERADOR — hoy sin módulo propio en el frontend (ver
 * `views/SinModulosView.tsx`). Exportado para que `routes.tsx` y esta misma
 * función no dupliquen el literal. */
export const OPERATOR_HOME_PATH = '/sin-modulos';

/**
 * Ruta de aterrizaje por rol — única fuente de verdad consumida por
 * `LoginView`, `GuestRoute`, `HomeRedirect` (ruta `/inicio`) y el
 * `start_url` del manifest PWA (ver `vite.config.ts`). Ver plan "Supervisión
 * en Terreno", sección "Diseño → Roles (frontend)":
 * - SUPERVISOR entra directo a Terreno (su única pantalla de trabajo);
 * - ADMIN/MANTENEDOR, al dashboard de escritorio;
 * - OPERADOR, que hoy no tiene módulo propio, a un aviso en vez del
 *   dashboard — nunca a pantallas de datos que no le corresponden.
 *
 * `role: null` (sesión sin rol reconocido) cae al dashboard, igual que
 * ADMIN/MANTENEDOR — `ProtectedRoute` lo termina de filtrar si no
 * corresponde.
 */
export function homePathFor(role: Role | null): string {
  switch (role) {
    case ROLES.SUPERVISOR:
      return '/terreno/registro';
    case ROLES.ADMIN:
    case ROLES.MANTENEDOR:
      return '/';
    case ROLES.OPERADOR:
      return OPERATOR_HOME_PATH;
    default:
      return '/';
  }
}
