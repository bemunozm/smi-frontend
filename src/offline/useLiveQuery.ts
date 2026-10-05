import { useCallback, useEffect, useMemo, useRef, useSyncExternalStore } from 'react';
import { liveQuery } from 'dexie';

/**
 * Puente mínimo entre `Dexie.liveQuery` y React, sin sumar el paquete
 * `dexie-react-hooks` como dependencia: `liveQuery` expone un `Observable`
 * (suscripción con `next`/`error`, sin snapshot síncrono), así que se cachea el
 * último valor emitido en un `ref` y se lo sirve a `useSyncExternalStore` — el
 * mismo patrón que documenta React para fuentes de datos externas asíncronas.
 *
 * `key` es el parámetro de la consulta (`querier` lo recibe): al cambiar se
 * recrea — el snapshot vuelve a `initialValue` hasta que la nueva consulta emite
 * su primer valor (una espera de microtask, invisible en la práctica). `querier` y
 * `initialValue` se leen por `ref`, así que cambiar de identidad en cada render del
 * llamador no recrea nada.
 */
export function useLiveQuery<T>(
  querier: (key: string | undefined) => T | Promise<T>,
  key: string | undefined,
  initialValue: T,
): T {
  const querierRef = useRef(querier);
  const initialRef = useRef(initialValue);
  const cacheRef = useRef<T>(initialValue);

  useEffect(() => {
    querierRef.current = querier;
    initialRef.current = initialValue;
  });

  const observable = useMemo(() => {
    cacheRef.current = initialRef.current;
    return liveQuery(() => querierRef.current(key));
  }, [key]);

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
