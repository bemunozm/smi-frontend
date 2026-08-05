import axios from 'axios';

import { env } from '../config/env';

/**
 * Instancia axios para llamadas de datos autenticadas por cookie de sesión
 * (`withCredentials: true`). Pensada para usarse dentro de las funciones de
 * dominio (`api/UserAPI.ts` y sucesores) que TanStack Query invoca como
 * `queryFn`/`mutationFn` — no reemplaza a `authClient` (Better Auth), que
 * sigue siendo la única vía para login/logout/sesión.
 *
 * Nota sobre mensajes de error: este archivo NO transforma ni reescribe
 * `error.message` — a propósito. Extraer el `message` del backend
 * (`error.response.data.message`) es responsabilidad exclusiva de cada
 * módulo de dominio (ver `api/UserAPI.ts#toDomainError`), que además sabe
 * qué fallback amigable mostrar si el backend no trae uno. Tener esa
 * lógica en dos lugares (acá y en `UserAPI.ts`) invitaba a que se
 * desincronizaran; esta instancia se mantiene deliberadamente "tonta".
 */
export const axiosInstance = axios.create({
  baseURL: env.apiUrl,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});
