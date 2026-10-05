import { useQuery } from '@tanstack/react-query';
import { toast } from '@heroui/react';

import { UmbralesAPI } from '../api/MantenimientoAPI';
import { UMBRALES_KEY as UMBRALES_QUERY_KEY } from '../lib/query-keys';
import { generateUuid } from '../lib/uuid';
import type { CreateUmbralInput } from '../types/mantenimiento';
import { useOfficeMutation } from './useOfficeMutation';

export function useUmbrales() {
  return useQuery({
    queryKey: UMBRALES_QUERY_KEY,
    queryFn: UmbralesAPI.list,
  });
}

export function useCrearUmbral() {
  return useOfficeMutation<'umbral.create', CreateUmbralInput>({
    endpoint: 'umbral.create',
    build: (input) => ({ params: {}, body: { ...input, id: generateUuid() } }),
    onSent: (umbral, input) => {
      toast.success('Umbral creado', {
        description: `${umbral?.tipoEquipo ?? input.tipoEquipo} · ${umbral?.tipoMantencion ?? input.tipoMantencion}`,
      });
    },
    errorFallback: 'No se pudo crear el umbral.',
  });
}
