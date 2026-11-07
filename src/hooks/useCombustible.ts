import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from '@heroui/react';

import { createCombustible, listCombustible } from '../api/CombustibleAPI';
import type { CreateCombustibleBody } from '../api/CombustibleAPI';
import { uploadFile } from '../api/UploadsAPI';
import { mensajeErrorOperacion } from '../lib/error-messages';
import { COMBUSTIBLE_KEY as KEY } from '../lib/query-keys';
import { generateUuid } from '../lib/uuid';
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

export interface CrearCargaCombustibleVars {
  values: Omit<CreateCombustibleBody, 'id' | 'fotoKey'>;
  /** Foto del surtidor — opcional en el alta manual del panel. */
  foto: File | null;
}

/**
 * Alta directa para la vista admin de cargas (escritorio, online): sube la
 * foto solo si hay, POST inmediato + invalidación del listado — sin outbox, a
 * diferencia de `useCreateCombustible` (Terreno). El `id` lo genera el cliente
 * igual: un reintento del POST no duplica la carga. Mismo patrón que
 * `useCrearTrabajoExtra`.
 */
export function useCrearCargaCombustible() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ values, foto }: CrearCargaCombustibleVars) => {
      const fotoKey = foto ? (await uploadFile(foto)).key : undefined;
      return createCombustible({
        ...values,
        ...(fotoKey ? { fotoKey } : {}),
        id: generateUuid(),
      });
    },
    onSuccess: () => {
      toast.success('Carga de combustible registrada');
      void queryClient.invalidateQueries({ queryKey: KEY });
    },
    onError: (error: unknown) => {
      toast.danger(
        mensajeErrorOperacion(error, 'No se pudo registrar la carga de combustible.'),
      );
    },
  });
}
