import { useQuery } from '@tanstack/react-query';
import { listCombustible } from '../api/CombustibleAPI';
import { COMBUSTIBLE_KEY as KEY } from '../lib/query-keys';
import { generateUuid } from '../lib/uuid';
import type { CombustibleForm } from '../types/combustible';
import { useOfficeMutation } from './useOfficeMutation';

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
  return useOfficeMutation<'combustible.create', CreateCombustibleVars>({
    endpoint: 'combustible.create',
    build: ({ input, foto }) => ({
      params: {},
      body: { ...input, id: generateUuid() },
      files: [{ field: 'fotoKey', file: foto }],
    }),
    onSent: () => undefined,
    errorFallback: 'No se pudo registrar la carga de combustible.',
  });
}
