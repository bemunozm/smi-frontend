import { isCacheOwnerMismatch, writeCacheOwner } from './cache-owner';
import { logger } from './logger';
import { queryClient } from './query-client';

/** Prefijo de los Cache Storage PRIVADOS de la app (`smi-api`, `smi-signed-files`,
 * `smi-images`, ver `vite.config.ts`) — todos arrancan con `smi-`. El precache de
 * Workbox (el JS/CSS/HTML del shell, con nombre tipo `workbox-precache-v2-...`) NO
 * lleva este prefijo a propósito: si se borrara, la app dejaría de abrir sin señal
 * hasta el próximo `fetch` exitoso del shell. Acá solo interesa quitar los DATOS
 * de la sesión que se fue, no el código de la app. */
const PRIVATE_CACHE_PREFIX = 'smi-';

/**
 * Borra los datos de la sesión que hay en el equipo: la caché de TanStack Query
 * (en memoria) y las cachés del Service Worker con respuestas de la API y
 * archivos ya firmados. NO toca la cola de registros sin enviar (IndexedDB): esas
 * operaciones son por usuario y las sigue enviando su dueño.
 *
 * Sin esto, quien inicia sesión después en el mismo equipo vería, hasta el próximo
 * refetch —o para siempre, sin señal—, equipos, documentos, fotos y el RUT de los
 * operadores de la sesión anterior. Lo usan el cierre de sesión y el inicio de una
 * sesión que no es la dueña de las cachés (`reconcileCacheOwner`).
 */
export async function purgeSessionData(): Promise<void> {
  queryClient.clear();
  if (typeof caches === 'undefined') return;
  try {
    const nombres = await caches.keys();
    await Promise.all(nombres.filter((nombre) => nombre.startsWith(PRIVATE_CACHE_PREFIX)).map((n) => caches.delete(n)));
  } catch (error) {
    // Best-effort: la cookie de sesión (lo que de verdad protege los datos) ya no
    // sirve, y un Cache Storage que falla (cuota, navegación privada de Safari) no
    // debe bloquear la salida de la persona.
    logger.error('No se pudo limpiar el Cache Storage de la sesión anterior.', error);
  }
}

/**
 * Se llama al confirmar una sesión: si las cachés del equipo son de otra sesión
 * (otro usuario, o la misma que terminó por vencimiento o 401) las purga, y deja
 * a este usuario como dueño. Sin dueño registrado (primera vez en el equipo, o
 * antes de que existiera este registro) lo adopta sin borrar nada.
 *
 * Devuelve `true` si había que purgar. La caché de TanStack se vacía de
 * inmediato; la del Service Worker se limpia en segundo plano.
 */
export function reconcileCacheOwner(userId: string): boolean {
  const mustPurge = isCacheOwnerMismatch(userId);
  writeCacheOwner(userId);
  if (mustPurge) void purgeSessionData();
  return mustPurge;
}
