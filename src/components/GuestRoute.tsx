import { Navigate, Outlet } from 'react-router-dom';
import { Spinner } from '@heroui/react';

import { useCurrentUser } from '../hooks/useCurrentUser';

/**
 * Inverso de `ProtectedRoute`: para rutas públicas como `/login` que no
 * tienen sentido con una sesión activa — si ya hay sesión, redirige a
 * `/inicio` (`HomeRedirect` reparte por rol, ver `config/home-path.ts`).
 *
 * `useCurrentUser()` ya resuelve `isAuthenticated`/`isPending` contra el
 * snapshot offline cuando corresponde (ver `hooks/useCurrentUser.ts`): un
 * arranque en frío sin señal, con una sesión guardada, no queda atrapado acá
 * mostrando el formulario de login (que tampoco podría enviarse sin red).
 */
export function GuestRoute() {
  const { isAuthenticated, isPending } = useCurrentUser();

  if (isPending) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Spinner color="accent" size="lg" />
      </div>
    );
  }

  if (isAuthenticated) {
    return <Navigate replace to="/inicio" />;
  }

  return <Outlet />;
}
