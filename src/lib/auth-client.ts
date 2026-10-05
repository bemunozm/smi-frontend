import { createAuthClient } from 'better-auth/react';
import { adminClient } from 'better-auth/client/plugins';

import { env } from '../config/env';
import { isServerSignOutPending } from './pending-signout';

/** `get-session` mientras falta cerrar la sesión en el servidor: no se manda. Se
 * responde "sin sesión" localmente, porque la cookie (aún válida) la reabriría. */
function sessionGate(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const url = input instanceof Request ? input.url : String(input);
  if (isServerSignOutPending() && url.includes('/get-session')) {
    return Promise.resolve(
      new Response('null', { status: 200, headers: { 'Content-Type': 'application/json' } }),
    );
  }
  return fetch(input, init);
}

/**
 * Cliente de Better Auth — ÚNICA fuente de verdad de la sesión en el
 * frontend. `useSession()` (consumido vía `hooks/useCurrentUser.ts`) lee la
 * cookie de sesión (httpOnly, gestionada por el backend); nunca se duplica
 * ese estado en Zustand ni se persiste un token a mano.
 *
 * `adminClient()` habilita el plugin admin del lado del cliente — sin él,
 * `session.user.role` no existe en el tipo inferido (queda tipado como
 * `string | undefined` incluso con el plugin; ver `types/roles.ts#isRole`
 * para angostarlo al union `Role`).
 */
export const authClient = createAuthClient({
  baseURL: env.apiUrl,
  plugins: [adminClient()],
  fetchOptions: { customFetchImpl: sessionGate },
});

export const { useSession, signIn, signOut } = authClient;
