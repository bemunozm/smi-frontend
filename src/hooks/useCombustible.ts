import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from '@heroui/react';
import { listCombustible, createCombustible } from '../api/CombustibleAPI';

const KEY = ['combustible'];

export function useCombustibleList() {
  return useQuery({ queryKey: KEY, queryFn: listCombustible });
}

export function useCreateCombustible() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createCombustible,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY });
      // Mismo fix que `useCreateHorometro`: sin esto, el "último nivel" y los
      // contadores de la ficha (`['equipment', id]`) no se refrescaban tras
      // registrar una carga.
      qc.invalidateQueries({ queryKey: ['equipment'] });
    },
    // La foto ya se subió (`uploadImage`) antes de llegar acá — si el POST de
    // combustible falla, sin este aviso queda una foto huérfana en
    // `/uploads` y el usuario cree que la carga se registró.
    onError: (error: unknown) => {
      toast.danger(error instanceof Error ? error.message : 'No se pudo registrar la carga de combustible.');
    },
  });
}
