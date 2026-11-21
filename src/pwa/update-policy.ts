/**
 * Política de actualización de la PWA (pedido del cliente, 21/11/2026): un
 * usuario siguió viendo la versión vieja porque la nueva quedó «en espera» y
 * nunca apretó «Actualizar». Acá viven las reglas puras; `ReloadPrompt` las
 * aplica.
 *
 * 1. Revisar si hay versión nueva cada `UPDATE_CHECK_INTERVAL_MS` y al volver
 *    a la pestaña, no solo al abrir la app.
 * 2. Si se cierra el aviso, volver a mostrarlo pasado `REPROMPT_AFTER_MS`.
 * 3. En el panel de administración, actualizar solo al cambiar de pantalla:
 *    navegar es la señal de que no hay un formulario a medio llenar. En
 *    Terreno, Taller y «Mi camioneta» se sigue preguntando, porque ahí se
 *    llenan formularios largos y sin señal.
 */

/** Cada cuánto se le pregunta al servidor si hay versión nueva. */
export const UPDATE_CHECK_INTERVAL_MS = 30 * 60 * 1000;

/** Cuánto espera el aviso cerrado antes de volver a aparecer. */
export const REPROMPT_AFTER_MS = 15 * 60 * 1000;

/**
 * Shells con formularios de campo (ver `routes.tsx`): Terreno, Taller y la
 * camioneta del prevencionista. `/login` e `/inicio` tampoco son del panel.
 */
const RUTAS_FUERA_DEL_PANEL = ['/terreno', '/mantenimiento', '/camioneta', '/login', '/inicio'];

/** `true` si `pathname` es una pantalla del panel de administración (`AppLayout`). */
export function isAdminPanelPath(pathname: string): boolean {
  return !RUTAS_FUERA_DEL_PANEL.some((ruta) => pathname === ruta || pathname.startsWith(`${ruta}/`));
}

/**
 * Se actualiza sola solo si se pasa de una pantalla del panel a OTRA del panel:
 * salir de Terreno al panel (o al revés) o quedarse en la misma ruta no cuenta.
 */
export function shouldAutoUpdateOnNavigation(from: string, to: string): boolean {
  return from !== to && isAdminPanelPath(from) && isAdminPanelPath(to);
}

/** Lo mínimo del `ServiceWorkerRegistration` que se usa (fácil de simular en tests). */
export interface UpdatableRegistration {
  installing: unknown;
  update: () => Promise<unknown>;
}

/**
 * Pregunta al servidor por una versión nueva, salvo sin señal o si ya hay una
 * instalándose. Nunca lanza: un fallo de red solo deja la revisión para la próxima.
 */
export async function checkForUpdate(registration: UpdatableRegistration, online: boolean): Promise<void> {
  if (!online || registration.installing) return;
  try {
    await registration.update();
  } catch {
    // Sin red o el servidor no respondió: se reintenta en la próxima revisión.
  }
}
