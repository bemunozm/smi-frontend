import { signOut } from './auth-client';
import { queryClient } from './query-client';

/** Prefijo de los Cache Storage PRIVADOS de la app (ver `vite.config.ts`:
 * `smi-signed-files`, `smi-uploads`, `smi-api`) — todos arrancan con `smi-`.
 * El precache de Workbox (los assets del build — JS/CSS/HTML del shell, con
 * nombre tipo `workbox-precache-v2-...`) NO lleva este prefijo a propósito:
 * si se borrara, la app dejaría de abrir offline hasta el próximo `fetch`
 * exitoso del shell — acá solo interesa purgar los DATOS del usuario que se
 * fue, no el propio código de la app. */
const PRIVATE_CACHE_PREFIX = 'smi-';

type NavigateFn = (to: string, options?: { replace?: boolean }) => void;

/**
 * Logout único para toda la app — reemplaza los `signOut()` sueltos que
 * vivían en `Topbar.tsx`/`TerrenoLayout.tsx` (único otro sitio que hoy
 * navega a `/login`; cualquier logout nuevo debe pasar por acá).
 *
 * Antes, `signOut()` + navegar dejaba dos fugas de datos privados
 * (SEGURIDAD M1, review QA del RFC R2-storage):
 * - TanStack Query seguía sirviendo desde su caché en memoria los datos del
 *   usuario anterior (equipos, documentos, fotos) hasta el próximo refetch;
 * - el Service Worker (`vite.config.ts`, regla `smi-signed-files`) seguía
 *   sirviendo desde Cache Storage archivos privados de Flota YA firmados
 *   (foto de equipo, documento, foto de carga) — sobrevivían al logout hasta
 *   que la entrada expirara sola (antes 30 días; bajado a 7 en el mismo fix,
 *   ver `vite.config.ts`).
 *
 * Orden: `signOut()` primero (invalida la cookie de sesión en el backend
 * antes de tocar nada del cliente), recién después se limpia el estado local
 * y se navega — así ninguna pantalla intermedia llega a pintar con datos del
 * usuario que se fue.
 */
export async function logout(navigate: NavigateFn): Promise<void> {
  await signOut();
  queryClient.clear();

  if ('caches' in window) {
    try {
      const cacheNames = await caches.keys();
      await Promise.all(
        cacheNames.filter((name) => name.startsWith(PRIVATE_CACHE_PREFIX)).map((name) => caches.delete(name)),
      );
    } catch (error) {
      // Best-effort: la cookie de sesión ya se invalidó arriba (lo que de
      // verdad protege los datos) — un Cache Storage que falla (cuota,
      // navegación privada de Safari) no debe bloquear la salida del usuario.
      console.error('No se pudo limpiar el Cache Storage al cerrar sesión:', error);
    }
  }

  navigate('/login', { replace: true });
}
