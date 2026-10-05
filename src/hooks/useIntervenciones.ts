import { useQuery } from '@tanstack/react-query';
import { toast } from '@heroui/react';

import { IntervencionesAPI } from '../api/MantenimientoAPI';
import { INTERVENCIONES_KEY } from '../lib/query-keys';
import type { CreateIntervencionInput } from '../types/mantenimiento';
import { useQueuedCreate } from './useQueuedMutation';

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
