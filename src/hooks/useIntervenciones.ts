import { useMutation, useQuery } from '@tanstack/react-query';
import { toast } from '@heroui/react';

import { IntervencionesAPI } from '../api/MantenimientoAPI';
import { mensajeErrorFormulario } from '../lib/error-messages';
import { avisarGuardadoEnCola } from '../lib/outbox-feedback';
import { INTERVENCIONES_KEY } from '../lib/query-keys';
import { generateUuid } from '../lib/uuid';
import type { CreateIntervencionInput, OrdenTrabajo } from '../types/mantenimiento';
import { useQueuedCreate, writeQueued } from './useQueuedMutation';

function intervencionesQueryKey(ordenId: string | undefined) {
  return [...INTERVENCIONES_KEY, ordenId] as const;
}

/** Bitácora de una OT puntual — deshabilitada hasta que se elija una `ordenId`. */
export function useIntervenciones(ordenId: string | undefined) {
  return useQuery({
    queryKey: intervencionesQueryKey(ordenId),
    queryFn: () => IntervencionesAPI.list(ordenId as string),
    enabled: !!ordenId,
  });
}

/**
 * Registrar intervención por la cola. El replay refresca la bitácora de la OT y
 * la lista de órdenes: una intervención puede afectar el estado/horómetro de la
 * OT en el backend.
 */
export function useCrearIntervencion() {
  return useQueuedCreate<'intervencion.create', { ordenId: string; input: CreateIntervencionInput }>({
    endpoint: 'intervencion.create',
    build: ({ ordenId, input }, id) => ({ params: { ordenId }, body: { ...input, id } }),
    onSent: () => {
      toast.success('Intervención registrada');
    },
    errorFallback: 'No se pudo registrar la intervención.',
  });
}

/**
 * "Finalizar tarea" del taller: encola la intervención de cierre (qué se hizo
 * + insumos + horómetro) y recién después el paso de la OT a COMPLETADA. El
 * orden importa: una orden completada sin su bitácora de cierre dejaría el
 * registro cojo, así que si la intervención falla la OT queda EN_PROCESO y se
 * puede reintentar. La cola conserva ese orden también sin señal, y la
 * invalidación la hace el replay (`invalidate` del registro
 * `offline/endpoints/mantenimiento`).
 */
export function useFinishTask() {
  return useMutation({
    mutationFn: async ({
      orden,
      intervencion,
      foto,
    }: {
      orden: OrdenTrabajo;
      intervencion: CreateIntervencionInput;
      /** Foto de lo realizado/ocupado: viaja como archivo del write y el
       * replay la sube e inyecta su `fotoKey` (patrón combustible). */
      foto?: File | null;
    }) => {
      const registered = await writeQueued('intervencion.create', {
        params: { ordenId: orden.id },
        body: { ...intervencion, id: generateUuid() },
        ...(foto ? { files: [{ field: 'fotoKey', file: foto }] } : {}),
      });
      const completed = await writeQueued('orden.update', {
        params: { id: orden.id },
        body: { estado: 'COMPLETADA' },
      });
      return { registered, completed };
    },
    onSuccess: ({ registered, completed }, { orden }) => {
      if (registered.status === 'queued' || completed.status === 'queued') {
        avisarGuardadoEnCola();
        return;
      }
      toast.success('Operación finalizada', { description: orden.titulo });
    },
    onError: (error: unknown) => {
      toast.danger(mensajeErrorFormulario(error, 'No se pudo finalizar la operación.'));
    },
  });
}
