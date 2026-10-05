import { signOut } from './auth-client';
import { clearCacheOwner } from './cache-owner';
import { clearSessionSnapshot } from './session-snapshot';
import { purgeSessionData } from './session-data';

type NavigateFn = (to: string, options?: { replace?: boolean }) => void;

/**
 * Logout único para toda la app: cualquier cierre de sesión debe pasar por acá.
 *
 * Quien cierra sesión sin conexión no puede esperar a que se envíen sus
 * registros. La cola (IndexedDB) NO se borra: las operaciones son por `userId`,
 * así que otra persona que use el equipo nunca las ve ni las envía, y se mandan
 * solas cuando su dueña vuelva a iniciar sesión. La UI avisa cuántos quedan antes
 * de llamar acá (`components/sync/useLogoutConfirmation`).
 *
 * `signOut()` y `queryClient.clear()` solos dejaban dos fugas de datos privados:
 * - TanStack Query seguía sirviendo desde su caché en memoria los datos del
 *   usuario anterior (equipos, documentos, fotos) hasta el próximo refetch;
 * - el Service Worker seguía sirviendo desde Cache Storage las lecturas de la API
 *   y los archivos privados ya firmados de Flota hasta que la entrada expirara.
 * `purgeSessionData` (`lib/session-data.ts`) limpia las dos.
 *
 * Orden: `signOut()` primero (invalida la cookie de sesión en el backend antes de
 * tocar nada del cliente), recién después se limpia el estado local y se navega —
 * así ninguna pantalla intermedia llega a pintar con datos del usuario que se fue.
 */
export async function logout(navigate: NavigateFn): Promise<void> {
  await signOut();
  // El snapshot offline (`lib/session-snapshot.ts`) es lo que le permite a
  // `useCurrentUser` seguir mostrando una sesión sin señal — un logout
  // explícito tiene que invalidarlo, si no el próximo arranque en frío sin
  // red "resucitaría" la sesión que el usuario cerró a propósito.
  clearSessionSnapshot();
  await purgeSessionData();
  // Las cachés quedaron vacías: no son de nadie. La próxima sesión las adopta
  // sin purgar otra vez.
  clearCacheOwner();
  navigate('/login', { replace: true });
}
