# React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some Oxlint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the Oxlint configuration

If you are developing a production application, we recommend enabling type-aware lint rules by installing `oxlint-tsgolint` and editing `.oxlintrc.json`:

```json
{
  "$schema": "./node_modules/oxlint/configuration_schema.json",
  "plugins": ["react", "typescript", "oxc"],
  "options": {
    "typeAware": true
  },
  "rules": {
    "react/rules-of-hooks": "error",
    "react/only-export-components": ["warn", { "allowConstantExport": true }]
  }
}
```

See the [Oxlint rules documentation](https://oxc.rs/docs/guide/usage/linter/rules) for the full list of rules and categories.

## Despliegue (Dokploy)

El frontend se despliega como una **Application** de Dokploy que construye la imagen del `Dockerfile` (nginx sirviendo el `dist`) en el propio VPS.

1. **Source:** Git, repositorio `https://github.com/bemunozm/smi-frontend.git`, rama `main`.
2. **Build type:** `Dockerfile` (ruta `./Dockerfile`, contexto `.`).
3. **Build args** (Dokploy los pasa con `--build-arg`):
   - `VITE_API_URL=https://smi.evonova.cl` (obligatorio). Es el ORIGEN del backend, sin `/api`; las rutas ya incluyen `/api/...`. Si falta, el build falla con un mensaje explícito.
   - `VITE_STORAGE_BUCKET` (opcional, default `smi-files`). Solo si el bucket del storage firmado tiene otro nombre.
4. **Domain:** host `smi.evonova.cl`, path `/`, puerto `80`, HTTPS con Let's Encrypt.
5. **Backend:** otra app de Dokploy (Compose, repo `smi-backend`) en el mismo host con path `/api`. Traefik prioriza la regla más larga, así que `/api` gana sobre `/` y el resto cae en este frontend.

`VITE_API_URL` y `VITE_STORAGE_BUCKET` quedan embebidos en el JS y en el service worker (el origen de la API entra en el patrón de caché de `sw.js`), por lo que cambiarlos exige **rebuild** de la imagen; no sirven como variables de runtime.

La imagen es multi-arch (`node:22-bookworm-slim` y `nginx:stable-alpine`) y trae un `HEALTHCHECK` en el puerto 80. `nginx/default.conf` define el fallback de SPA, caché inmutable para `/assets/` y `no-cache` para `index.html`, `sw.js`, `registerSW.js`, `workbox-*.js` y `manifest.webmanifest`, de modo que la PWA se actualice.

Prueba local de la imagen:

```bash
docker build --build-arg VITE_API_URL=https://smi.evonova.cl -t smi-frontend .
docker run --rm -p 127.0.0.1:8099:80 smi-frontend
```
