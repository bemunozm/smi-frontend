/**
 * Reconoce URLs firmadas de R2/MinIO para Flota (foto de equipo, documento de
 * equipo, foto de carga de combustible) — llevan `X-Amz-Signature` en el
 * query string (firma SigV4). Se usa para armar una regla `runtimeCaching`
 * dedicada en `vite.config.ts`, registrada ANTES de la regla genérica de
 * imágenes cross-origin (ver Diseño del RFC R2-storage, sección "PWA"):
 * objetos firmados son inmutables (key = uuid, nunca se reescriben), así que
 * se cachean `CacheFirst` con la key SIN el query — la firma cambia cada
 * `TTL/2` (ver `StorageService.sign`), pero el contenido del objeto no.
 *
 * ⚠️ Esta es la fuente ÚNICA para tests. La copia que corre de verdad en el
 * service worker vive INLINE en `vite.config.ts` — workbox-build serializa
 * `urlPattern`/`cacheKeyWillBeUsed` con `Function.prototype.toString()`, así
 * que esas funciones no pueden depender de imports ni de scope externo (ver
 * el comentario de `vite.config.ts`). Si cambiás la lógica acá, replicá el
 * cambio a mano en la regla `smi-signed-files` de `vite.config.ts`.
 */
export function isSignedFileUrl(url: URL): boolean {
  return url.searchParams.has('X-Amz-Signature');
}

/** Quita el query string de una URL — usado como `cacheKeyWillBeUsed` del
 * plugin de Workbox para que la entrada de caché no cambie cuando la firma se
 * renueva cada `TTL/2` (misma key de caché para el mismo objeto inmutable,
 * sin importar qué firma trajo la respuesta). */
export function stripSignedUrlQuery(url: string): string {
  const parsed = new URL(url);
  parsed.search = '';
  return parsed.toString();
}
