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
 * Extrae `code` del body `{ data, message, code? }` — el clasificador de
 * negocio opcional que homogeniza `HttpExceptionFilter` (backend, ver
 * `smi-backend/src/common/filters/http-exception.filter.ts`) SOLO cuando
 * quien lanzó la excepción lo puso explícito (ej. `new
 * ConflictException({ message, code: 'EQUIPMENT_BUSY' })`). `undefined` en
 * cualquier otro caso — nunca se inventa a partir del `message`.
 */
export function extractBackendCode(data: unknown): string | undefined {
  if (typeof data !== 'object' || data === null || !('code' in data)) {
    return undefined;
  }
  const raw = (data as { code?: unknown }).code;
  return typeof raw === 'string' && raw.trim().length > 0 ? raw : undefined;
}

/**
 * Error de dominio que arma `toDomainError`. Sigue siendo un `Error` común
 * — mismo `.message`, mismo `instanceof Error` — así que los ~40 callers
 * existentes de `toDomainError` (que solo leen `.message`) no ven ningún
 * cambio. Además lleva, cuando corresponde, `code` (el clasificador de
 * negocio del backend, ver `extractBackendCode`) y `status` (el HTTP status
 * de la respuesta) — para el caller que SÍ necesita diferenciar casos de
 * negocio sin volver a parsear `.message` (ver `hooks/useShiftCards.ts`,
 * Supervisión en Terreno).
 */
export class DomainError extends Error {
  readonly code?: string;
  readonly status?: number;

  constructor(message: string, options?: { code?: string; status?: number }) {
    super(message);
    this.name = 'DomainError';
    this.code = options?.code;
    this.status = options?.status;
  }
}

/**
 * Mensaje único para el 409 `OPERATOR_INACTIVE` — lo puede devolver
 * cualquier endpoint que valida el operador contra el catálogo propio
 * (`OperatorsService.assertActive`, backend): Tarjetas de turno
 * (`hooks/useShiftCards.ts`), asignación de equipos (`hooks/useEquipment.ts`)
 * y Trabajos extra (`hooks/useTrabajosExtra.ts`) comparten el mismo caso de
 * negocio y no tenían por qué mostrar tres redacciones distintas del mismo
 * error.
 */
export const OPERATOR_INACTIVE_MESSAGE = 'Ese operador ya no está activo. Elegí otro del catálogo.';

/**
 * Mensaje de un error de axios que nunca recibió respuesta (sin señal, DNS,
 * timeout). Lo que NUNCA se encola (usuarios, notificaciones, ver
 * `offline/endpoints`) no queda esperando en silencio: el guardado falla rápido
 * con este aviso (ver `lib/query-client.ts`, `mutations.networkMode`). Las
 * escrituras que sí se encolan no lo muestran: `offline/replay.ts` las reintenta.
 */
export const NETWORK_ERROR_MESSAGE = 'Sin señal: no se pudo guardar. Revisá la conexión e intentá de nuevo.';

/** El mensaje habla de "guardar", así que solo aplica a requests que
 * escriben — una lectura que no llegó (GET) conserva el fallback propio de
 * su `api/<X>API.ts`. */
function esMetodoDeEscritura(method: string | undefined): boolean {
  return method != null && !['get', 'head', 'options'].includes(method.toLowerCase());
}

/**
 * Normaliza cualquier error capturado en un `api/<X>API.ts` a un `Error`
 * con mensaje claro, distinguiendo el origen:
 * - `ZodError`: el backend (o el mock) respondió pero el shape no calza
 *   con nuestro contrato (`types/<x>.ts`) — bug de contrato, no de red.
 * - Error de axios sin respuesta (red caída) en una request que ESCRIBE:
 *   `NETWORK_ERROR_MESSAGE`, sin `status`. En una lectura sin respuesta, el
 *   fallback del caller.
 * - Error de axios con respuesta: prioriza el `message` descriptivo del backend
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
export function toDomainError(error: unknown, fallbackMessage: string): DomainError {
  if (error instanceof ZodError) {
    const firstIssue = error.issues[0]?.message ?? 'formato inesperado';
    // `code: 'INVALID_RESPONSE'`: sin esto,
    // `offline/replay.ts#classify` no tenía forma de distinguir esto de un
    // error de red (mismo `status: undefined`) — un reintento automático de
    // una respuesta que el servidor SÍ procesó (ej. un `openCard` replayado
    // cuyo 200 de vuelta no calza con el schema) volvía a fallar exactamente
    // igual cada vez, trabando la cola entera para siempre en vez de quedar
    // en `needs_attention` y dejar avanzar el resto.
    return new DomainError(`Respuesta inválida: ${firstIssue}`, { code: 'INVALID_RESPONSE' });
  }
  if (axios.isAxiosError(error)) {
    // Sin respuesta (red caída/timeout): `status` queda `undefined` a
    // propósito — `offline/replay.ts#classify` depende de eso para tratarlo
    // como transitorio y reintentar.
    if (!error.response && esMetodoDeEscritura(error.config?.method)) {
      return new DomainError(NETWORK_ERROR_MESSAGE);
    }
    const backendMessage = extractBackendMessage(error.response?.data);
    return new DomainError(backendMessage ?? fallbackMessage, {
      code: extractBackendCode(error.response?.data),
      status: error.response?.status,
    });
  }
  if (error instanceof Error) {
    return new DomainError(error.message);
  }
  return new DomainError(fallbackMessage);
}
