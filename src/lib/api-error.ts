import axios from 'axios';
import { ZodError } from 'zod';

/**
 * Extrae `message` del body `{ data, message }` que el backend devuelve
 * incluso en 4xx/5xx (ver contratos en `types/`). `data` llega como
 * `unknown` a propósito — es la barrera que evita que el `any` implícito de
 * `AxiosError.response.data` se filtre al resto del código.
 */
export function extractBackendMessage(data: unknown): string | undefined {
  if (typeof data !== 'object' || data === null || !('message' in data)) {
    return undefined;
  }
  const raw = (data as { message?: unknown }).message;
  return typeof raw === 'string' && raw.trim().length > 0 ? raw : undefined;
}

/**
 * Normaliza cualquier error capturado en un `api/<X>API.ts` a un `Error`
 * con mensaje claro, distinguiendo el origen:
 * - `ZodError`: el backend (o el mock) respondió pero el shape no calza
 *   con nuestro contrato (`types/<x>.ts`) — bug de contrato, no de red.
 * - Error de axios: prioriza el `message` descriptivo del backend
 *   (`error.response.data.message`, p. ej. "User already exists"). Si no
 *   vino ninguno (caída de red, 500 sin body, etc.) usa `fallbackMessage`
 *   — NUNCA el `error.message` técnico de axios ("Request failed with
 *   status code 500", "Network Error"), que no le sirve a quien lo lee.
 * - Cualquier otro `unknown`: fallback genérico.
 *
 * Única fuente de verdad del mensaje de error para TODOS los `api/<X>API.ts`
 * — cada dominio la importa, no la duplica (ver `CLAUDE.md`). `lib/axios.ts`
 * no reescribe `error.message` precisamente para que esta sea la única
 * lógica de mensajes en todo el frontend.
 */
export function toDomainError(error: unknown, fallbackMessage: string): Error {
  if (error instanceof ZodError) {
    const firstIssue = error.issues[0]?.message ?? 'formato inesperado';
    return new Error(`Respuesta inválida: ${firstIssue}`);
  }
  if (axios.isAxiosError(error)) {
    const backendMessage = extractBackendMessage(error.response?.data);
    return new Error(backendMessage ?? fallbackMessage);
  }
  if (error instanceof Error) {
    return new Error(error.message);
  }
  return new Error(fallbackMessage);
}
