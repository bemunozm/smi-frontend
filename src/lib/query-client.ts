import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      // `'offlineFirst'` (default es `'online'`): con `'online'` TanStack
      // Query directamente SALTA la request si `navigator.onLine` es
      // `false` y sirve lo que tenga en caché sin marcar error — en un
      // arranque en frío sin señal (RFC "Supervisión en Terreno" §Diseño →
      // Offline) eso deja la pantalla en `isPending` para siempre si el
      // Service Worker todavía no alcanzó a responder. `'offlineFirst'`
      // intenta la request igual (el SW `smi-api`, `NetworkFirst`, la
      // resuelve desde su cache si la red falla) y solo cae a error si NI
      // la red NI el cache tienen nada. Las mutaciones se configuran
      // aparte, abajo.
      networkMode: 'offlineFirst',
    },
    mutations: {
      // `'always'` (default `'online'`): con `'online'` una mutación sin señal
      // se PAUSA en silencio — `isPending` para siempre y ningún `onError` —,
      // y el usuario cree que se está guardando. Los módulos de oficina no
      // tienen cola offline (solo Terreno, vía el outbox de `offline/`, que no
      // usa mutaciones de TanStack), así que acá es mejor fallar rápido con el
      // aviso de `toDomainError` ("Sin señal…") que esperar.
      networkMode: 'always',
    },
  },
});
