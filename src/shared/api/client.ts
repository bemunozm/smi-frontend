import axios from 'axios';

import { env } from '../../config/env';

/**
 * Instancia axios para las llamadas de datos del bloque Terreno. Usa la
 * config de entorno del equipo (`config/env`); el backend expone el dominio
 * bajo `/api`, y la sesión va por cookie de Better Auth (`withCredentials`).
 *
 * Nota: es una instancia aparte de `lib/axios.ts` (que no prefija `/api`);
 * este bloque mobile mantiene su propio cliente hasta unificar el patrón
 * con el resto del front.
 */
export const api = axios.create({
  baseURL: `${env.apiUrl}/api`,
  withCredentials: true,
});
