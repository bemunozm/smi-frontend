import { authClient, signOut } from './auth-client';
import { clearServerSignOutPending, isServerSignOutPending, markServerSignOutPending } from './pending-signout';

/** `signOut()` resolvió el cierre en el servidor. Sin respuesta (red caída, timeout)
 * o con un error del servidor, la cookie puede seguir viva; un 401 quiere decir que
 * ya no hay sesión que cerrar. */
async function signOutReachedServer(): Promise<boolean> {
  try {
    const result = await signOut();
    const status = result?.error?.status;
    return !result?.error || status === 401;
  } catch {
    return false;
  }
}

/**
 * Cierra la sesión en el servidor; si no puede (sin señal), deja la marca de cierre
 * pendiente. Nunca lanza: el cierre local sigue de todos modos.
 */
export async function signOutOrDefer(): Promise<boolean> {
  const done = await signOutReachedServer();
  if (!done) markServerSignOutPending();
  return done;
}

let revoking: Promise<boolean> | null = null;

/**
 * Completa un cierre pendiente: llama a `signOut()` (que revoca la cookie en el
 * servidor) y recién entonces borra la marca. Devuelve `true` si no hay nada
 * pendiente o se logró; `false` si sigue pendiente (se vuelve a intentar al volver la
 * señal). Varias llamadas a la vez comparten un solo intento.
 */
export function revokePendingSignOut(): Promise<boolean> {
  if (!isServerSignOutPending()) return Promise.resolve(true);
  revoking ??= signOutReachedServer()
    .then((done) => {
      if (done) clearServerSignOutPending();
      return done;
    })
    .finally(() => {
      revoking = null;
    });
  return revoking;
}

const PENDING_SIGNOUT_LOGIN_MESSAGE =
  'Falta cerrar la sesión anterior en el servidor. Conectate a internet e intentá de nuevo.';

export interface EmailCredentials {
  email: string;
  password: string;
}

/** Lo que la pantalla de login necesita de un intento: el mensaje a mostrar, si falló. */
export interface SignInResult {
  error: { message?: string } | null;
}

/**
 * Inicia sesión con correo y contraseña, después de completar el cierre de sesión
 * pendiente del usuario anterior (`revokePendingSignOut`): si no se puede (sin señal,
 * tampoco se podría iniciar sesión) no se envía nada y el error lo explica.
 */
export async function signInWithEmail(credentials: EmailCredentials): Promise<SignInResult> {
  if (!(await revokePendingSignOut())) return { error: { message: PENDING_SIGNOUT_LOGIN_MESSAGE } };
  const { error } = await authClient.signIn.email(credentials);
  return { error };
}

/** Al arrancar la app y cada vez que vuelve la señal, intenta completar el cierre pendiente. */
export function startSignOutRevocation(): void {
  void revokePendingSignOut();
  window.addEventListener('online', () => void revokePendingSignOut());
}
