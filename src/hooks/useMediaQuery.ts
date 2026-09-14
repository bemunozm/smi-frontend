import { useCallback, useSyncExternalStore } from 'react';

/**
 * Suscribe a una media query del navegador.
 *
 * Se usa para elegir ENTRE dos estructuras distintas, no para esconder una con
 * CSS: el listado de inventario es una tabla en escritorio y tarjetas en
 * teléfono/tablet, y montar las dos para tapar una con `hidden` duplicaría cada
 * ítem en el DOM — el doble de nodos, y un lector de pantalla leyendo dos veces
 * el mismo inventario. Para diferencias de puro estilo (espaciados, columnas de
 * una grilla) van las clases `sm:`/`lg:` de Tailwind, que no montan nada.
 *
 * `useSyncExternalStore` en vez de `useState` + `useEffect` para que el primer
 * render ya salga con el valor correcto y no haya un parpadeo de tarjetas antes
 * de la tabla.
 */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const list = window.matchMedia(query);
      list.addEventListener('change', onChange);
      return () => list.removeEventListener('change', onChange);
    },
    [query],
  );

  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    // En servidor no hay ventana; se asume el caso chico, que es el que más
    // van a usar en faena.
    () => false,
  );
}

/** `lg` de Tailwind: desde acá el listado cabe como tabla. */
export const DESKTOP_QUERY = '(min-width: 1024px)';
