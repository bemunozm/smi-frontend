# syntax=docker/dockerfile:1

# ---- build ----------------------------------------------------------------
FROM node:22-bookworm-slim AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# Vite hornea estas variables en el bundle y en el service worker (el origen de
# la API entra en el patrón de runtimeCaching), así que son build args y no
# variables de runtime: cambiar cualquiera exige reconstruir la imagen.
# Se declaran después de `npm ci` para que un cambio de valor no invalide la
# capa de dependencias.
#   VITE_API_URL         obligatoria. ORIGEN del backend, sin `/api`
#                        (ej. https://smi.evonova.cl).
#   VITE_STORAGE_BUCKET  opcional. Bucket del storage firmado
#                        (default de vite.config.ts: smi-files).
# Las VITE_PREVIEW_* solo aplican a `vite preview` en la prueba con túnel y no
# intervienen en este build.
ARG VITE_API_URL
ARG VITE_STORAGE_BUCKET

RUN if [ -z "${VITE_API_URL}" ]; then \
      echo "ERROR: falta el build arg VITE_API_URL (origen del backend, ej. https://smi.evonova.cl)." >&2; \
      echo "       Usa --build-arg VITE_API_URL=... o defínelo en los build args de Dokploy." >&2; \
      exit 1; \
    fi; \
    case "${VITE_API_URL}" in \
      http://*|https://*) ;; \
      *) echo "ERROR: VITE_API_URL debe empezar con http:// o https:// (recibido: ${VITE_API_URL})." >&2; exit 1 ;; \
    esac; \
    case "${VITE_API_URL}" in \
      */api|*/api/) echo "ERROR: VITE_API_URL es el ORIGEN del backend, sin el sufijo /api (recibido: ${VITE_API_URL})." >&2; exit 1 ;; \
    esac

# `npm run build` = `tsc -b && vite build`: el build también valida tipos.
RUN VITE_API_URL="${VITE_API_URL}" VITE_STORAGE_BUCKET="${VITE_STORAGE_BUCKET}" npm run build

# ---- runtime --------------------------------------------------------------
FROM nginx:stable-alpine AS runtime

RUN rm -f /etc/nginx/conf.d/default.conf
COPY nginx/security-headers.conf /etc/nginx/snippets/security-headers.conf
COPY nginx/default.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -q --spider http://127.0.0.1/ || exit 1
