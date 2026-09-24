import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd())
  const apiOrigin = new URL(env.VITE_API_URL || 'http://localhost:3000').origin

  // Los `urlPattern` de `runtimeCaching` se serializan con
  // `Function.prototype.toString()`/`RegExp.prototype.toString()` DENTRO del
  // service worker generado (ver workbox-build `runtime-caching-converter`):
  // no pueden cerrar sobre variables externas (el closure se pierde al
  // stringificar la función, y el identificador queda como referencia rota
  // en el `sw.js` final). Por eso el origen de la API se hornea como texto
  // literal dentro de un `RegExp` — un RegExp sí serializa su propio código
  // fuente completo (`/patrón/flags`), sin depender de scope externo.
  const escapedOrigin = apiOrigin.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const apiUploadsPattern = new RegExp(`^${escapedOrigin}/uploads/.*`)
  const apiReadPattern = new RegExp(`^${escapedOrigin}/(?!api/auth/|uploads/).*`)

  return {
    plugins: [
      react(),
      tailwindcss(),
      VitePWA({
        registerType: 'prompt',
        // `null` está deprecado a favor de `false` (mismo efecto: no
        // inyectar ningún registro automático — `ReloadPrompt.tsx` registra
        // el SW a mano vía `virtual:pwa-register/react`).
        injectRegister: false,
        manifest: {
          name: 'SMI — Sistema de Mantenimiento e Inventario',
          short_name: 'SMI',
          description:
            'Gestión de mantenimiento e inventario de flota en terreno, con lectura disponible sin conexión.',
          lang: 'es',
          display: 'standalone',
          start_url: '/',
          scope: '/',
          theme_color: '#1d4ed8',
          background_color: '#e9ebee',
          // Sin `icons`: `pwaAssets` (abajo) los genera desde
          // `public/favicon.svg` y los inyecta acá automáticamente
          // (192/512/maskable-512 + un 64x64 extra que trae el preset).
        },
        pwaAssets: {
          image: 'public/favicon.svg',
          // Los <link>/<meta> de favicon y theme-color ya los escribimos a
          // mano en `index.html` (íconos apple-touch-icon, apple-mobile-web-app-*,
          // theme-color) — desactivado para no duplicarlos.
          includeHtmlHeadLinks: false,
          injectThemeColor: false,
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,svg,woff2,woff,png,ico}'],
          navigateFallback: '/index.html',
          navigateFallbackDenylist: [/^\/api/, /^\/uploads/],
          runtimeCaching: [
            {
              // Archivos firmados de Flota (foto de equipo, documento, foto de
              // carga de combustible — R2/MinIO, ver Diseño del RFC
              // R2-storage, sección "PWA"). Va ANTES de la regla genérica de
              // imágenes cross-origin de abajo: objetos firmados son
              // inmutables (key = uuid), así que se cachean con la key SIN el
              // query — la firma cambia cada `TTL/2` pero el contenido no.
              //
              // Fuente única para tests: `src/pwa/signed-url-cache.ts`
              // (`isSignedFileUrl`/`stripSignedUrlQuery`). Esta copia queda
              // INLINE y AUTOCONTENIDA a propósito — ver el comentario de
              // `escapedOrigin` más arriba sobre por qué `urlPattern`/
              // `cacheKeyWillBeUsed` no pueden depender de imports ni de
              // scope externo (workbox-build los serializa con
              // `Function.prototype.toString()`). Replicá a mano cualquier
              // cambio de lógica en ambos lugares.
              urlPattern: ({ url }) => url.searchParams.has('X-Amz-Signature'),
              method: 'GET',
              handler: 'CacheFirst',
              options: {
                cacheName: 'smi-signed-files',
                cacheableResponse: { statuses: [200] },
                // 7 días (no 30): son archivos PRIVADOS de Flota (foto de
                // equipo, documento, foto de carga) — un logout ya los borra
                // de Cache Storage a propósito (ver `lib/logout.ts`,
                // SEGURIDAD M1 del review QA), pero esta ventana más corta
                // acota la exposición residual para el caso en que el
                // navegador nunca llegue a correr ese logout (cierre
                // abrupto, storage no evictado, etc.).
                expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 7 },
                plugins: [
                  {
                    cacheKeyWillBeUsed: async ({ request }) => {
                      const url = new URL(request.url)
                      url.search = ''
                      return url.toString()
                    },
                  },
                ],
              },
            },
            {
              // Fotos/adjuntos servidos por el backend: lectura offline de lo
              // ya visto, prioridad a lo cacheado (cambian poco una vez subidos).
              urlPattern: apiUploadsPattern,
              method: 'GET',
              handler: 'CacheFirst',
              options: {
                cacheName: 'smi-uploads',
                cacheableResponse: { statuses: [200] },
                expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 30 },
              },
            },
            {
              // Imágenes en general (cualquier origen), mismo criterio que uploads.
              urlPattern: ({ request }) => request.destination === 'image',
              handler: 'CacheFirst',
              options: {
                cacheName: 'smi-images',
                cacheableResponse: { statuses: [200] },
                expiration: { maxEntries: 100, maxAgeSeconds: 60 * 60 * 24 * 30 },
              },
            },
            {
              // GET de dominio (mismo host que `VITE_API_URL`), EXCLUYENDO
              // `/api/auth/*` (sesión Better Auth: nunca se cachea) y
              // `/uploads/*` (ya cubierto arriba). `NetworkFirst` con timeout
              // corto: prioriza datos frescos, cae a caché ante conexión
              // intermitente en terreno sin colgar la UI esperando la red.
              urlPattern: apiReadPattern,
              method: 'GET',
              handler: 'NetworkFirst',
              options: {
                cacheName: 'smi-api',
                networkTimeoutSeconds: 10,
                cacheableResponse: { statuses: [200] },
                expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 },
              },
            },
          ],
        },
        devOptions: {
          enabled: true,
        },
      }),
    ],
  }
})
