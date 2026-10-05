import { logger } from '../lib/logger';
import type { QueryKeyName } from '../lib/query-keys';

/** Cache del Service Worker con las lecturas de la API (`vite.config.ts`, regla
 * `NetworkFirst`). El nombre se repite allí a mano: el service worker no puede
 * importar de `src/`. */
export const API_CACHE_NAME = 'smi-api';

/** Raíz de la ruta de la API que alimenta cada grupo de queries. */
const API_PATH_BY_QUERY_KEY: Readonly<Record<QueryKeyName, string>> = {
  shiftCards: '/api/shift-cards',
  shiftCardsMine: '/api/shift-cards',
  hallazgos: '/api/hallazgos',
  trabajosExtra: '/api/trabajos-extra',
  horometro: '/api/horometro',
  equipment: '/api/equipment',
  equipmentDocuments: '/api/equipment',
  combustible: '/api/combustible',
  inventory: '/api/inventory',
  branches: '/api/branches',
  operators: '/api/operators',
  ordenes: '/api/mantenimiento',
  intervenciones: '/api/mantenimiento',
  actividades: '/api/mantenimiento',
  umbrales: '/api/mantenimiento',
};

function estaBajo(pathname: string, raiz: string): boolean {
  return pathname === raiz || pathname.startsWith(`${raiz}/`);
}

/**
 * Borra del cache del Service Worker las lecturas de las listas que una
 * sincronización acaba de cambiar. Con `NetworkFirst` y `networkTimeoutSeconds`,
 * si el refetch que sigue a la sincronización tarda más que el plazo, Workbox
 * responde con la copia vieja (anterior al cambio) y TanStack Query la toma por
 * dato fresco: lo recién sincronizado "desaparece" hasta el siguiente refetch. Sin
 * copia en el cache, el SW no tiene con qué responder y espera a la red, que es lo
 * que se pide. El refetch que sigue vuelve a llenarlo.
 *
 * Best-effort: un cache que no se puede abrir no debe impedir sincronizar.
 */
export async function purgeApiCacheFor(names: Iterable<QueryKeyName>): Promise<void> {
  if (typeof caches === 'undefined') return;
  const raices = new Set([...names].map((name) => API_PATH_BY_QUERY_KEY[name]));
  if (raices.size === 0) return;
  try {
    if (!(await caches.has(API_CACHE_NAME))) return;
    const cache = await caches.open(API_CACHE_NAME);
    const requests = await cache.keys();
    await Promise.all(
      requests
        .filter((request) => {
          const { pathname } = new URL(request.url);
          return [...raices].some((raiz) => estaBajo(pathname, raiz));
        })
        .map((request) => cache.delete(request)),
    );
  } catch (error) {
    logger.error('No se pudo actualizar el cache de lecturas tras sincronizar.', error);
  }
}
