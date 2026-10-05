/**
 * Pide al navegador que no borre el almacenamiento de la app (IndexedDB con la
 * cola de registros sin enviar, y los caches del Service Worker) cuando el
 * equipo anda corto de espacio. Es best-effort: algunos navegadores no lo
 * soportan y otros lo niegan a un sitio que no está instalado.
 *
 * Devuelve `true` si el almacenamiento quedó persistente. Si ya lo estaba no
 * vuelve a pedirlo.
 */
export async function requestPersistentStorage(): Promise<boolean> {
  if (typeof navigator === 'undefined' || !('storage' in navigator)) return false;
  const { storage } = navigator;
  try {
    if (typeof storage.persisted === 'function' && (await storage.persisted())) return true;
    if (typeof storage.persist !== 'function') return false;
    return await storage.persist();
  } catch {
    return false;
  }
}
