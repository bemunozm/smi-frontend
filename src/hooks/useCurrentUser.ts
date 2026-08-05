import { useSession } from '../lib/auth-client';
import { isRole, type Role } from '../types/roles';

type SessionData = ReturnType<typeof useSession>['data'];

/** Usuario tal como lo devuelve Better Auth (incluye `role` sin angostar). */
export type CurrentSessionUser = NonNullable<SessionData>['user'];

export interface CurrentUser {
  user: CurrentSessionUser | null;
  /** `role` angostado al union `Role` (null si falta o es un valor desconocido). */
  role: Role | null;
  isPending: boolean;
  isAuthenticated: boolean;
}

/**
 * Wrapper cómodo sobre `useSession()`. `useSession()` (Better Auth) sigue
 * siendo la ÚNICA fuente de verdad de la sesión — este hook no agrega
 * estado propio, solo empaqueta la forma en la que los componentes la
 * consumen (usuario tipado, rol angostado) para no repetir la misma lógica
 * de destructuring/type-guard en cada componente.
 */
export function useCurrentUser(): CurrentUser {
  const { data: session, isPending } = useSession();
  const role = session?.user.role;

  return {
    user: session?.user ?? null,
    role: isRole(role) ? role : null,
    isPending,
    isAuthenticated: !!session,
  };
}
