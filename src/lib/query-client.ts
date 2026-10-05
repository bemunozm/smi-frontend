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
      // la red NI el cache tienen nada. Mutaciones sin tocar: siguen
      // `'online'` — no tiene sentido "mutar desde caché".
      networkMode: 'offlineFirst',
    },
  },
});
