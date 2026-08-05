/**
 * Fuente única de configuración de entorno del frontend. `lib/auth-client.ts`
 * y `lib/axios.ts` importan `apiUrl` de acá en vez de leer
 * `import.meta.env` cada uno por su cuenta.
 */
export interface AppConfig {
  apiUrl: string;
}

export const env: AppConfig = {
  apiUrl: import.meta.env.VITE_API_URL,
};
