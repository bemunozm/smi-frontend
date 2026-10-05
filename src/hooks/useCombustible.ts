import { useQuery } from '@tanstack/react-query';
import { toast } from '@heroui/react';

import { listCombustible } from '../api/CombustibleAPI';
import { COMBUSTIBLE_KEY as KEY } from '../lib/query-keys';
import type { CombustibleForm } from '../types/combustible';
import { useQueuedCreate } from './useQueuedMutation';

export function useCombustibleList() {
  return useQuery({ queryKey: KEY, queryFn: listCombustible });
}

export interface CreateCombustibleVars {
  input: Omit<CombustibleForm, 'fotoUrl' | 'fotoKey'>;
  /** Foto del surtidor (obligatoria): se guarda en el equipo y se sube al
   * sincronizar, no al elegirla — sin señal no habría cómo. */
  foto: File;
}

/**
 * Registrar una carga de combustible por la cola. La foto viaja como archivo de
 * la operación; si la subida o el POST fallan por falta de señal, todo se
 * reintenta solo. El replay refresca la lista y `['equipment']` (último nivel y
 * contadores de la ficha).
 */
export function useCreateCombustible() {
  return useQueuedCreate<'combustible.create', CreateCombustibleVars>({
    endpoint: 'combustible.create',
    build: ({ input, foto }, id) => ({
      params: {},
      body: { ...input, id },
      files: [{ field: 'fotoKey', file: foto }],
    }),
    onSent: () => {
      toast.success('Carga de combustible registrada');
    },
    errorFallback: 'No se pudo registrar la carga de combustible.',
  });
}
