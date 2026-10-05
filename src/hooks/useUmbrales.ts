import { useQuery } from '@tanstack/react-query';
import { toast } from '@heroui/react';

import { UmbralesAPI } from '../api/MantenimientoAPI';
import { UMBRALES_KEY as UMBRALES_QUERY_KEY } from '../lib/query-keys';
import type { CreateUmbralInput } from '../types/mantenimiento';
import { useQueuedCreate } from './useQueuedMutation';

export function useUmbrales() {
  return useQuery({
    queryKey: UMBRALES_QUERY_KEY,
    queryFn: UmbralesAPI.list,
  });
}

export function useCrearUmbral() {
  return useQueuedCreate<'umbral.create', CreateUmbralInput>({
    endpoint: 'umbral.create',
    build: (input, id) => ({ params: {}, body: { ...input, id } }),
    onSent: (umbral, input) => {
      toast.success('Umbral creado', {
        description: `${umbral?.tipoEquipo ?? input.tipoEquipo} · ${umbral?.tipoMantencion ?? input.tipoMantencion}`,
      });
    },
    errorFallback: 'No se pudo crear el umbral.',
  });
}
