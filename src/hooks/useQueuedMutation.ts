import { useMutation, type UseMutationResult } from '@tanstack/react-query';
import { toast } from '@heroui/react';

import { mensajeErrorFormulario } from '../lib/error-messages';
import { avisarGuardadoEnCola } from '../lib/outbox-feedback';
import { generateUuid } from '../lib/uuid';
import type { EndpointBody, EndpointKey, EndpointParams, EndpointResult } from '../offline/endpoints';
import {
  OFFICE_WAIT_MS,
  submitWrite,
  type SubmitWriteInput,
  type SubmitWriteOptions,
  type SubmitWriteResult,
} from '../offline/submit-write';

/**
 * Escribe por la cola con la espera de oficina: unos segundos para poder mostrar
 * un error de negocio en el formulario. Lo que quede esperando (sin señal,
 * servidor lento) se da por guardado en el equipo y se envía solo.
 */
export function writeQueued<K extends EndpointKey>(
  endpoint: K,
  input: SubmitWriteInput<K>,
  options: Partial<SubmitWriteOptions> = {},
): Promise<SubmitWriteResult<K>> {
  return submitWrite(endpoint, input, { waitMs: OFFICE_WAIT_MS, ...options });
}

/** Resultado de una mutación encolada: `unchanged` cuando no había nada que
 * mandar (una edición que no cambió ningún campo). */
export type QueuedWriteResult<K extends EndpointKey> = SubmitWriteResult<K> | { status: 'unchanged' };

export interface QueuedMutationConfig<K extends EndpointKey, TVars> {
  endpoint: K;
  /** Arma lo que se encola. `null` = no hay nada que mandar. */
  build: (vars: TVars) => SubmitWriteInput<K> | null | Promise<SubmitWriteInput<K> | null>;
  /** El servidor confirmó a tiempo. `data` es `null` si su respuesta no calzó
   * con el contrato: el aviso no puede apoyarse en ella. */
  onSent?: (data: EndpointResult<K> | null, vars: TVars) => void;
  /** `build` no tuvo nada que encolar (p. ej. el cambio se absorbió en una
   * operación que seguía en la cola). Sin esto no hay aviso. */
  onUnchanged?: (vars: TVars) => void;
  errorFallback: string;
  /** Mensaje propio para un error; sin él, el de `mensajeErrorFormulario`. */
  errorMessage?: (error: unknown) => string;
  /** Cuánto esperar el resultado. Por defecto, la espera de oficina; `0` guarda
   * y vuelve (Terreno: el resultado llega después, por la hoja de sincronización). */
  waitMs?: number;
  /** A nombre de quién se encola, si no es el usuario de la sesión del motor. */
  userId?: string;
}

/**
 * `useMutation` de una escritura por la cola. El feedback vive acá, como en el
 * resto de los hooks: `sent` → el aviso del dominio, `queued` → el aviso común de
 * "guardado en el equipo", error → toast. La invalidación NO va acá: la hace el
 * replay al terminar la operación, con las keys de su entrada del registro
 * (`offline/endpoints`).
 */
export function useQueuedMutation<K extends EndpointKey, TVars>(
  config: QueuedMutationConfig<K, TVars>,
): UseMutationResult<QueuedWriteResult<K>, Error, TVars> {
  return useMutation<QueuedWriteResult<K>, Error, TVars>({
    mutationFn: async (vars) => {
      const input = await config.build(vars);
      if (!input) return { status: 'unchanged' };
      return writeQueued(config.endpoint, input, {
        ...(config.waitMs === undefined ? {} : { waitMs: config.waitMs }),
        ...(config.userId === undefined ? {} : { userId: config.userId }),
      });
    },
    onSuccess: (result, vars) => {
      if (result.status === 'sent') config.onSent?.(result.data, vars);
      else if (result.status === 'queued') avisarGuardadoEnCola();
      else config.onUnchanged?.(vars);
    },
    onError: (error) => {
      toast.danger(config.errorMessage ? config.errorMessage(error) : mensajeErrorFormulario(error, config.errorFallback));
    },
  });
}

/** Claves cuyo endpoint crea una entidad: el cuerpo lleva el `id` que genera el cliente. */
type CreateKey = {
  [K in EndpointKey]: EndpointBody<K> extends { id: string } ? K : never;
}[EndpointKey];

export interface QueuedCreateConfig<K extends CreateKey, TVars>
  extends Omit<QueuedMutationConfig<K, TVars>, 'build'> {
  /** Arma lo que se encola con el `id` que el cliente le da a la entidad: con él
   * un reenvío de la misma operación no duplica el registro. */
  build: (vars: TVars, id: string) => SubmitWriteInput<K> | Promise<SubmitWriteInput<K>>;
}

/** Crear una entidad: la mutación genera el `id` y se lo pasa a `build`. */
export function useQueuedCreate<K extends CreateKey, TVars>(
  config: QueuedCreateConfig<K, TVars>,
): UseMutationResult<QueuedWriteResult<K>, Error, TVars> {
  return useQueuedMutation<K, TVars>({ ...config, build: (vars) => config.build(vars, generateUuid()) });
}

/** Claves de un `DELETE /…/:id`: `params` es solo el `id` y el cuerpo va vacío. */
type DeleteKey = {
  [K in EndpointKey]: EndpointParams<K> extends { id: string }
    ? { id: string } extends EndpointParams<K>
      ? Record<string, never> extends EndpointBody<K>
        ? K
        : never
      : never
    : never;
}[EndpointKey];

export interface QueuedDeleteConfig<K extends DeleteKey> {
  endpoint: K;
  /** Texto del aviso cuando el servidor confirma (`'Equipo eliminado'`). */
  sentMessage: string;
  /** El 409 del backend explica por qué no se puede y qué hacer en su lugar:
   * llega tal cual; esto solo cubre un error sin mensaje. */
  errorFallback: string;
}

/** Borrar una entidad por su `id`. */
export function useQueuedDelete<K extends DeleteKey>(
  config: QueuedDeleteConfig<K>,
): UseMutationResult<QueuedWriteResult<K>, Error, string> {
  return useQueuedMutation<K, string>({
    endpoint: config.endpoint,
    build: (id) => ({ params: { id }, body: {} }),
    onSent: () => {
      toast.success(config.sentMessage);
    },
    errorFallback: config.errorFallback,
  });
}
