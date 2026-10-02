# Prueba en tablet detrás de un túnel HTTPS

Runbook para probar el build de producción (`vite preview`) en una tablet real,
con la API y el storage firmado bajo el MISMO origen que el front. Es necesario
porque la PWA instalada y su outbox de IndexedDB son estrictos por origen, y
así no hay CORS ni cookies entre sitios distintos.

```
Tablet ─HTTPS→ cloudflared ─→ vite preview :4173
                                ├─ /api/*       → :3001 (Nest)
                                └─ /smi-files/* → :9000 (MinIO, Host preservado)
```

## 1. Levantar el túnel primero (da la URL)

```bash
cloudflared tunnel --url http://localhost:4173
```

Copiá la URL que imprime (`https://<algo>.trycloudflare.com`): es el
**origen del túnel** de todos los pasos siguientes. El túnel puede quedar
levantado aunque el preview todavía no exista.

## 2. Backend con ese origen

Las variables de entorno del proceso tienen prioridad sobre `.env` (dotenv no
las pisa):

```bash
FRONTEND_URL=<origen> BETTER_AUTH_URL=<origen> STORAGE_PUBLIC_ENDPOINT=<origen> \
AUTH_RATE_LIMIT_ENABLED=true npm run start:dev
```

- `STORAGE_PUBLIC_ENDPOINT`: las URLs firmadas se firman contra ESE host. Si
  no calza con el Host que recibe MinIO, las fotos y el PDF dan 403.
- Antes de exponer, rotá las contraseñas del seed (ver el TUNNEL CHECKLIST de
  `smi-backend/SECURITY-NOTES.md`):
  `NEW_PASSWORD='...' npm run user:set-password -- --email supervisor@smi.local`

## 3. Build y preview del front

```bash
VITE_API_URL=<origen> VITE_PREVIEW_PROXY=true npm run build
VITE_PREVIEW_PROXY=true npx vite preview --port 4173 --strictPort
```

`VITE_PREVIEW_PROXY=true` va en **los dos** comandos:
- en el build, porque `VITE_API_URL` arma el `apiReadPattern` del service worker;
- en el preview, porque el `preview.proxy` se lee al arrancar `vite preview`, no queda horneado en el build.

Sin él, `/api/*` devuelve el `index.html` del SPA. Verificá que
`<origen>/api/health` responda `{"status":"ok"}`.

## 4. En la tablet

1. Abrí `<origen>`, iniciá sesión e **instalá la app** (Safari → Compartir →
   "Agregar a inicio"). En iPad, Safari borra los datos de las páginas NO
   instaladas después de 7 días sin uso.
2. Abrila desde el ícono y tocá "Preparar para uso sin señal".
3. Modo avión, cerrá la app, reabrila (arranque en frío), abrí y cerrá tarjetas con foto, y enviá el reporte.
4. Volvé a tener señal: la barra debe llegar sola a "Todo sincronizado". Revisá en el servidor las tarjetas, el PDF y el aviso a los ADMIN.

## 5. Advertencias

- La URL del quick tunnel **cambia en cada reinicio** de `cloudflared`.
  Fijarla requiere una cuenta de Cloudflare y un dominio propio (named tunnel).
- La PWA instalada y su outbox son **por origen**: si el túnel se reinicia a
  mitad de la prueba, lo que haya quedado en cola en la tablet no se puede
  enviar al origen nuevo. Toda la prueba corre en **UNA sola sesión de túnel**.
- Detrás del proxy, el rate limit de login ve todas las requests como
  `127.0.0.1`. Da igual para una tablet, pero no sirve para producción.
- Para automatizar esta prueba con Playwright/Chromium en Windows, usá un
  profile en una ruta corta (p. ej. `C:\pwtest`). Con rutas largas, Cache
  Storage falla (`InvalidAccessError`) y el service worker queda `redundant`.
