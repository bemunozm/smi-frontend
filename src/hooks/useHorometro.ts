import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from '@heroui/react';
import { listHorometro, createHorometro } from '../api/HorometroAPI';

const KEY = ['horometro'];

export function useHorometroList() {
  return useQuery({ queryKey: KEY, queryFn: listHorometro });
}

export function useCreateHorometro() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createHorometro,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY });
      // La key real del dominio Equipos es `['equipment']` (ver
      // `useEquipment.ts:11`) — `['equipos']` nunca existió como query y esta
      // invalidación no refrescaba ni la tabla ni la ficha tras registrar.
      qc.invalidateQueries({ queryKey: ['equipment'] });
    },
    // Sin esto, un fallo de red/validación quedaba en silencio: el modal de
    // registro cierra optimistamente su propio estado en algunos flujos y el
    // usuario nunca se entera de que la lectura no se guardó.
    onError: (error: unknown) => {
      toast.danger(error instanceof Error ? error.message : 'No se pudo registrar la lectura.');
    },
  });
}
