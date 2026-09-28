import { Navigate } from 'react-router-dom';

import { homePathFor } from '../config/home-path';
import { useCurrentUser } from '../hooks/useCurrentUser';

/**
 * Único destino de `/inicio` — reparte por rol (`homePathFor`). Vive DENTRO
 * de `ProtectedRoute` (ver `routes.tsx`), así que para cuando este componente
 * monta ya hay sesión confirmada (o su snapshot offline, ver
 * `hooks/useCurrentUser.ts`): no repite el manejo de `isPending`/login, solo
 * decide a dónde ir.
 *
 * `LoginView` navega acá tras un login exitoso (salvo que haya un
 * `location.state.from` al que volver) y el `start_url` del manifest PWA
 * (`vite.config.ts`) abre la app directamente en esta ruta.
 */
export function HomeRedirect() {
  const { role } = useCurrentUser();

  return <Navigate replace to={homePathFor(role)} />;
}
