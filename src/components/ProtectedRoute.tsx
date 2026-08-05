import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { Spinner } from '@heroui/react';

import { useCurrentUser } from '../hooks/useCurrentUser';
import type { Role } from '../types/roles';

export interface ProtectedRouteProps {
  /** Si se define, solo estos roles pueden acceder; sin definir = cualquier sesión válida. */
  allowedRoles?: readonly Role[];
}

/**
 * Guard de rutas basado en `useCurrentUser()` (wrapper de `useSession()`,
 * fuente única de verdad de la sesión). Se usa como `element` de una
 * `<Route>` padre; las rutas hijas se renderizan vía `<Outlet />`.
 */
export function ProtectedRoute({ allowedRoles }: ProtectedRouteProps) {
  const { isAuthenticated, isPending, role } = useCurrentUser();
  const location = useLocation();

  if (isPending) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Spinner color="accent" size="lg" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate replace state={{ from: location }} to="/login" />;
  }

  if (allowedRoles && (!role || !allowedRoles.includes(role))) {
    return <Navigate replace to="/forbidden" />;
  }

  return <Outlet />;
}
