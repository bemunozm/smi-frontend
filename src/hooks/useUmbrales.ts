import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from '@heroui/react';

import { UmbralesAPI } from '../api/MantenimientoAPI';
import type { CreateUmbralInput } from '../types/mantenimiento';

const UMBRALES_QUERY_KEY = ['umbrales'] as const;

export function useUmbrales() {
  return useQuery({
    queryKey: UMBRALES_QUERY_KEY,
    queryFn: UmbralesAPI.list,
  });
}

export function useCrearUmbral() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateUmbralInput) => UmbralesAPI.create(input),
    onSuccess: (umbral) => {
      void queryClient.invalidateQueries({ queryKey: UMBRALES_QUERY_KEY });
      toast.success('Umbral creado', { description: `${umbral.tipoEquipo} · ${umbral.tipoMantencion}` });
    },
    onError: (error: unknown) => {
      toast.danger(error instanceof Error ? error.message : 'No se pudo crear el umbral.');
    },
  });
}
