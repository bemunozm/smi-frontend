import { isStandalonePwa } from './standalone';

/**
 * Rebote del botón Atrás en la raíz del historial — SOLO como PWA instalada.
 *
 * En Android, Atrás en la primera entrada del historial significa "salir de
 * la app". En la tablet del taller la app vive anclada (Anclar ventanas) y
 * salir está bloqueado: el WebAPK intenta cerrarse, no puede, y se relanza
 * colgado en el splash. Para que ese "atrás final" nunca llegue al sistema:
 *
 * - Al arrancar en frío (la entrada inicial, `idx: 0` de React Router) se
 *   duplica la entrada: queda un colchón debajo de la vista.
 * - Cada vez que un Atrás cae en el colchón (`idx: 0` otra vez — misma URL,
 *   la vista no cambia), se vuelve a duplicar. Neto: Atrás en la raíz no
 *   hace nada; en cualquier vista interior (`idx` > 0) navega normal.
 *
 * El estado duplicado conserva la forma de React Router (`{ usr, key, idx }`):
 * el router ve la misma location y no re-navega. En pestaña de navegador no
 * se instala nada — ahí Atrás sí debe poder salir del sitio.
 *
 * Instalar DESPUÉS de crear el router (`routes.tsx`): su `replaceState`
 * inicial es el que fija `idx: 0`.
 */
export function instalarReboteAtras(): () => void {
  if (!isStandalonePwa()) return () => {};

  const duplicar = (estado: unknown) => window.history.pushState(estado, '', window.location.href);
  const idxDe = (estado: unknown): number => (estado as { idx?: number } | null)?.idx ?? 0;

  // Colchón solo en arranque en frío: tras recargar a mitad del historial
  // (`idx` > 0) no se mete nada, para no convertir el primer Atrás en no-op.
  if (idxDe(window.history.state) === 0) duplicar(window.history.state);

  const alVolver = (evento: PopStateEvent) => {
    if (idxDe(evento.state) === 0) duplicar(evento.state);
  };
  window.addEventListener('popstate', alVolver);
  return () => window.removeEventListener('popstate', alVolver);
}
