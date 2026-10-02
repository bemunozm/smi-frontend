import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd())
  const apiOrigin = new URL(env.VITE_API_URL || 'http://localhost:3000').origin
  // Mismo default que el backend (`DEFAULT_DEV_STORAGE_BUCKET`,
  // `smi-backend/src/common/config/env.ts`) — el nombre del bucket es parte
  // del PATH público (`/<bucket>/...`, ver `STORAGE_PUBLIC_ENDPOINT`), así
  // que el proxy de túnel (`preview.proxy`, abajo) y el denylist de
  // Workbox necesitan conocerlo.
  const storageBucketPath = env.VITE_STORAGE_BUCKET || 'smi-files'

  // Los `urlPattern` de `runtimeCaching` se serializan con
  // `Function.prototype.toString()`/`RegExp.prototype.toString()` DENTRO del
  // service worker generado (ver workbox-build `runtime-caching-converter`):
  // no pueden cerrar sobre variables externas (el closure se pierde al
  // stringificar la función, y el identificador queda como referencia rota
  // en el `sw.js` final). Por eso el origen de la API se hornea como texto
  // literal dentro de un `RegExp` — un RegExp sí serializa su propio código
  // fuente completo (`/patrón/flags`), sin depender de scope externo.
  const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const escapedOrigin = escapeRegExp(apiOrigin)
  // Restringido al prefijo `/api` (revisión QA, prep túnel): antes matcheaba
  // CUALQUIER GET del origen de la API salvo `/api/auth/*` — inofensivo
  // mientras la API y el front vivían en orígenes distintos, pero en modo
  // mismo-origen (`preview.proxy`, abajo: API y storage bajo el MISMO host
  // del túnel) esto capturaría también las rutas de la app (`/inicio`, etc.)
  // y los objetos de `/smi-files/*` — ambos servidos por Workbox como si
  // fueran lecturas de la API. El global prefix de Nest es `/api`
  // (`smi-backend/src/app.setup.ts#setGlobalPrefix`). El lookahead ya no
  // excluye `/uploads/*`: el backend retiró esa ruta en la Fase 3 (RFC
  // "Supervisión en Terreno" §Cierre de R2: "retirar `src/uploads/*`") —
  // junto con la regla `smi-uploads` dedicada que vivía en `runtimeCaching`
  // (abajo).
  const apiReadPattern = new RegExp(`^${escapedOrigin}/api/(?!auth/).*`)

  // Solo para la prueba en tablet detrás de un túnel HTTPS único (ver
  // `docs/tunel-tablet.md`) — el dev normal (`vite`/`vite dev`) no pasa por
  // `preview` y no se ve afectado. `VITE_PREVIEW_PROXY=true` habilita
  // `vite preview` como same-origin gateway: la API (`/api`) y el storage
  // firmado (`/smi-files`) quedan proxeados bajo el MISMO host del túnel
  // (`*.trycloudflare.com`), porque el service worker/PWA instalada trata
  // cross-origin distinto y el flujo completo (login, outbox, descarga de
  // PDF) tiene que probarse bajo un solo origen, igual que en producción.
  const previewProxyEnabled = env.VITE_PREVIEW_PROXY === 'true'

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
          // `id` fija la identidad del manifest — SIN esto, cambiar
          // `start_url` haría que el navegador viera una PWA "nueva" (icono
          // duplicado, progreso de instalación perdido). Se fija a `/`
          // (el valor histórico de `start_url`) para que instalaciones
          // existentes no se rompan.
          id: '/',
          // `/inicio` reparte por rol (`HomeRedirect`, ver
          // `config/home-path.ts`) en vez de abrir siempre el dashboard.
          start_url: '/inicio',
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
        // `clientsClaim: true`: el SW nuevo toma control de las pestañas YA
        // abiertas apenas termina de activarse, en vez de esperar a que se
        // cierren y vuelvan a abrir — clave para el arranque en frío sin
        // señal (RFC "Supervisión en Terreno" §Diseño → Offline): una
        // tablet que se dejó preparada el día anterior (ver
        // `components/terreno/SyncStatus.tsx`, "Preparar para uso sin
        // señal") debe quedar servida por el SW más reciente desde el
        // primer load, sin depender de un cierre manual de la app.
        // `registerType: 'prompt'` (abajo, sin tocar) sigue pidiendo
        // confirmación antes de ACTIVAR una versión nueva — `clientsClaim`
        // solo cambia qué pasa una vez que esa activación ya ocurrió.
        workbox: {
          clientsClaim: true,
          // Default de Workbox: 2 MiB. El bundle principal ya lo supera
          // (Dexie, Fase 5 offline, sumado a lo que ya traía la app) — sin
          // subir esto, `vite build` FALLA (Workbox se niega a precachear un
          // archivo más grande que el límite) y la app queda sin su propio
          // código en el precache, es decir, sin poder arrancar en frío sin
          // señal — justo lo que esta fase tiene que garantizar. 3 MiB deja
          // margen sin dejar de ser una señal si el bundle sigue creciendo.
          // Partir el bundle (code-splitting por ruta) es el arreglo de raíz
          // pendiente — fuera del alcance de esta fase.
          maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
          globPatterns: ['**/*.{js,css,html,svg,woff2,woff,png,ico}'],
          navigateFallback: '/index.html',
          // `/smi-files` (o el bucket que `VITE_STORAGE_BUCKET` indique):
          // sin este denylist, la navegación de descarga del PDF (redirect
          // 302 de `GET /api/shift-reports/:id/file` a la URL firmada,
          // MISMO origen en modo túnel — ver `preview.proxy` arriba) caería
          // en `NavigationRoute` y Workbox serviría `index.html` en vez de
          // dejar pasar la redirección al archivo real.
          navigateFallbackDenylist: [/^\/api/, new RegExp(`^/${escapeRegExp(storageBucketPath)}`)],
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
              // Imágenes en general (cualquier origen). La regla dedicada a
              // `/uploads/*` (`smi-uploads`) se retiró acá: el backend dejó
              // de servir esa ruta en la Fase 3 (RFC "Supervisión en
              // Terreno" §Cierre de R2) — los adjuntos de Flota van todos
              // por `smi-signed-files`, arriba.
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
              // `/api/auth/*` (sesión Better Auth: nunca se cachea).
              // `NetworkFirst` con timeout corto: prioriza datos frescos,
              // cae a caché ante conexión intermitente en terreno sin colgar
              // la UI esperando la red.
              urlPattern: apiReadPattern,
              method: 'GET',
              handler: 'NetworkFirst',
              options: {
                cacheName: 'smi-api',
                networkTimeoutSeconds: 10,
                cacheableResponse: { statuses: [200] },
                // 72 h (antes 24): una tablet "preparada" (`SyncStatus`, ver
                // el plan "Supervisión en Terreno" §Diseño → Offline) puede
                // quedar lista el jueves para una prueba del sábado — 24 h
                // la dejaba fría para el arranque en frío del fin de semana.
                expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 72 },
              },
            },
          ],
        },
        devOptions: {
          enabled: true,
        },
      }),
    ],
    // Solo cuando `VITE_PREVIEW_PROXY=true` (ver el comentario de
    // `previewProxyEnabled` arriba) — el dev normal (`vite`) nunca pasa por
    // acá, así que esto no cambia nada del flujo de trabajo de todos los
    // días.
    ...(previewProxyEnabled
      ? {
          preview: {
            // El host real es un subdominio aleatorio de Cloudflare Quick
            // Tunnel (`https://<algo>.trycloudflare.com`, distinto en cada
            // `cloudflared tunnel --url ...`) — Vite rechaza cualquier Host
            // header que no esté en esta lista por defecto.
            allowedHosts: ['.trycloudflare.com'],
            proxy: {
              '/api': {
                target: 'http://localhost:3001',
                // `changeOrigin: false`: preserva el Host header original
                // (el del túnel) al reenviar al backend — el backend valida
                // origen/cookies contra `FRONTEND_URL`/`BETTER_AUTH_URL`,
                // que en esta prueba SON el origen del túnel.
                changeOrigin: false,
              },
              [`/${storageBucketPath}`]: {
                target: 'http://localhost:9000',
                // `changeOrigin: false` acá es OBLIGATORIO, no solo prolijo:
                // la firma SigV4 de la URL cubre el Host que el backend usó
                // al firmar (`STORAGE_PUBLIC_ENDPOINT` = origen del túnel,
                // ver `docs/tunel-tablet.md`). Si el proxy reescribiera el
                // Host al del target (`localhost:9000`, el default de
                // `changeOrigin: true`), MinIO recalcularía la firma con un
                // Host distinto al firmado y la rechazaría con 403.
                changeOrigin: false,
              },
            },
          },
        }
      : {}),
  }
})
