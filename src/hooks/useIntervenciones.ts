import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from '@heroui/react';

import { IntervencionesAPI } from '../api/MantenimientoAPI';
import type { CreateIntervencionInput } from '../types/mantenimiento';

const ORDENES_QUERY_KEY = ['ordenes'] as const;

function intervencionesQueryKey(ordenId: string | undefined) {
  return ['intervenciones', ordenId] as const;
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
 * Registrar intervención — feedback centralizado acá (patrón `useUsers.ts`).
 * Invalida tanto la bitácora de la OT como la lista de órdenes: una
 * intervención puede afectar el estado/horómetro de la OT en el backend.
 */
export function useCrearIntervencion() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ ordenId, input }: { ordenId: string; input: CreateIntervencionInput }) =>
      IntervencionesAPI.create(ordenId, input),
    onSuccess: (_intervencion, variables) => {
      void queryClient.invalidateQueries({ queryKey: intervencionesQueryKey(variables.ordenId) });
      void queryClient.invalidateQueries({ queryKey: ORDENES_QUERY_KEY });
      toast.success('Intervención registrada');
    },
    onError: (error: unknown) => {
      toast.danger(error instanceof Error ? error.message : 'No se pudo registrar la intervención.');
    },
  });
}
