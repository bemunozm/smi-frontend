import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from '@heroui/react';

import { ActividadesAPI } from '../api/MantenimientoAPI';
import type { CreateActividadInput, UpdateActividadInput } from '../types/mantenimiento';

const ACTIVIDADES_QUERY_KEY = ['actividades'] as const;

export function useActividades() {
  return useQuery({
    queryKey: ACTIVIDADES_QUERY_KEY,
    queryFn: ActividadesAPI.list,
  });
}

export function useCrearActividad() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateActividadInput) => ActividadesAPI.create(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ACTIVIDADES_QUERY_KEY });
      toast.success('Actividad asignada');
    },
    onError: (error: unknown) => {
      toast.danger(error instanceof Error ? error.message : 'No se pudo crear la actividad.');
    },
  });
}

export function useActualizarActividad() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateActividadInput }) =>
      ActividadesAPI.update(id, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ACTIVIDADES_QUERY_KEY });
      toast.success('Actividad actualizada');
    },
    onError: (error: unknown) => {
      toast.danger(error instanceof Error ? error.message : 'No se pudo actualizar la actividad.');
    },
  });
}
