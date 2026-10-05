import { useMutation, type UseMutationResult } from '@tanstack/react-query';
import { toast } from '@heroui/react';

import { mensajeErrorFormulario } from '../lib/error-messages';
import { avisarGuardadoEnCola } from '../lib/outbox-feedback';
import type { EndpointKey, EndpointResult } from '../offline/endpoints';
import { OFFICE_WAIT_MS, submitWrite, type SubmitWriteInput, type SubmitWriteResult } from '../offline/submit-write';

/**
 * Escrituras de oficina: pasan por la MISMA cola que Terreno (`submitWrite`),
 * esperando el resultado unos segundos para poder mostrar un error de negocio en
 * el formulario. Lo que quede esperando (sin señal, servidor lento) se da por
 * guardado en el equipo y se envía solo.
 */
export function writeOffice<K extends EndpointKey>(
  endpoint: K,
  input: SubmitWriteInput<K>,
): Promise<SubmitWriteResult<K>> {
  return submitWrite(endpoint, input, { waitMs: OFFICE_WAIT_MS });
}

/** Resultado de una mutación de oficina: `unchanged` cuando no había nada que
 * mandar (una edición que no cambió ningún campo). */
export type OfficeWriteResult<K extends EndpointKey> = SubmitWriteResult<K> | { status: 'unchanged' };

export interface OfficeMutationConfig<K extends EndpointKey, TVars> {
  endpoint: K;
  /** Arma lo que se encola. `null` = no hay nada que mandar. */
  build: (vars: TVars) => SubmitWriteInput<K> | null | Promise<SubmitWriteInput<K> | null>;
  /** El servidor confirmó a tiempo. `data` es `null` si su respuesta no calzó
   * con el contrato: el toast no puede apoyarse en ella. */
  onSent: (data: EndpointResult<K> | null, vars: TVars) => void;
  /** Quedó guardado en el equipo. Por defecto, el aviso común de la cola. */
  onQueued?: (vars: TVars) => void;
  errorFallback: string;
  /** Mensaje propio para un error de negocio; sin él, el de `mensajeErrorFormulario`. */
  errorMessage?: (error: unknown) => string;
}

/**
 * `useMutation` de una escritura de oficina por la cola. El feedback vive acá,
 * como en el resto de los hooks: `sent` → el toast de siempre, `queued` → el
 * aviso de "guardado en el equipo", error de negocio → `onError`. La
 * invalidación NO va acá: la hace el replay al terminar la operación, con las
 * keys de su entrada del registro (`offline/endpoints`).
 */
export function useOfficeMutation<K extends EndpointKey, TVars>(
  config: OfficeMutationConfig<K, TVars>,
): UseMutationResult<OfficeWriteResult<K>, Error, TVars> {
  return useMutation<OfficeWriteResult<K>, Error, TVars>({
    mutationFn: async (vars) => {
      const input = await config.build(vars);
      if (!input) return { status: 'unchanged' };
      return writeOffice(config.endpoint, input);
    },
    onSuccess: (result, vars) => {
      if (result.status === 'sent') {
        config.onSent(result.data, vars);
      } else if (result.status === 'queued') {
        if (config.onQueued) config.onQueued(vars);
        else avisarGuardadoEnCola();
      }
    },
    onError: (error) => {
      toast.danger(config.errorMessage ? config.errorMessage(error) : mensajeErrorFormulario(error, config.errorFallback));
    },
  });
}
