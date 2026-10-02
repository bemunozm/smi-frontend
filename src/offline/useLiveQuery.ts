import { useCallback, useMemo, useRef, useSyncExternalStore } from 'react';
import { liveQuery } from 'dexie';

/**
 * Puente mínimo entre `Dexie.liveQuery` y React, sin depender del paquete
 * `dexie-react-hooks` (no aprobado — ver el plan "Supervisión en Terreno"
 * §Dependencias): `liveQuery` expone un `Observable` (suscripción con
 * `next`/`error`, sin snapshot síncrono), así que se cachea el último valor
 * emitido en un `ref` y se lo sirve a `useSyncExternalStore` — el mismo
 * patrón que documenta React para fuentes de datos externas asíncronas.
 *
 * `deps` recrea la consulta (mismo criterio que `useMemo`/`useEffect`) — al
 * cambiar, el snapshot vuelve a `initialValue` hasta que la nueva consulta
 * emite su primer valor (una espera de microtask, invisible en la práctica).
 */
export function useLiveQuery<T>(querier: () => T | Promise<T>, deps: unknown[], initialValue: T): T {
  const cacheRef = useRef<T>(initialValue);

  // eslint-disable-next-line react-hooks/exhaustive-deps -- `deps` es la API pública de este hook, no `querier` (que cambia de identidad en cada render del llamador).
  const observable = useMemo(() => {
    cacheRef.current = initialValue;
    return liveQuery(querier);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  const subscribe = useCallback(
    (onStoreChange: () => void) => {
      const subscription = observable.subscribe({
        next: (value: T) => {
          cacheRef.current = value;
          onStoreChange();
        },
        // Un error de consulta no debe tumbar la pantalla — se deja el
        // último valor bueno conocido (`cacheRef.current` sin tocar) y se
        // re-renderiza por si el consumidor quiere mostrar algo distinto.
        error: () => onStoreChange(),
      });
      return () => subscription.unsubscribe();
    },
    [observable],
  );

  const getSnapshot = useCallback(() => cacheRef.current, []);

  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
