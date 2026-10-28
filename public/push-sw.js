/**
 * Handlers de Web Push del service worker. Vive en `public/` como script
 * CLÁSICO (sin módulos ni build) porque lo carga `importScripts` del SW que
 * genera vite-plugin-pwa (`workbox.importScripts` en `vite.config.ts`) — así
 * la estrategia `generateSW` y toda la config offline quedan intactas.
 *
 * El payload lo arma el backend (`PushService.sendToUser`):
 * `{ notificationId, tipo, titulo, cuerpo, data }`.
 */

self.addEventListener('push', (event) => {
  // Parseo defensivo: un push sin datos o con JSON corrupto no puede reventar
  // el SW — se muestra un aviso genérico (iOS además EXIGE mostrar algo por
  // cada push recibido con userVisibleOnly).
  let payload = null;
  try {
    payload = event.data ? event.data.json() : null;
  } catch {
    payload = null;
  }

  const titulo = payload && payload.titulo ? payload.titulo : 'SMI';
  const options = {
    body:
      payload && payload.cuerpo
        ? payload.cuerpo
        : 'Tienes una notificación nueva.',
    icon: '/pwa-192x192.png',
    badge: '/pwa-64x64.png',
    data: payload,
  };

  event.waitUntil(self.registration.showNotification(titulo, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  // Si la app ya está abierta, SOLO se enfoca — navegarla podría destruir un
  // formulario de terreno a medio llenar. Sin ventanas, se abre el centro de
  // notificaciones, que deja cualquier aviso a un toque de distancia.
  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((windows) => {
        if (windows.length > 0) {
          return windows[0].focus();
        }
        return self.clients.openWindow('/notificaciones');
      }),
  );
});
