import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from '@heroui/react';

import { OrdenesAPI } from '../api/MantenimientoAPI';
import type { CreateOrdenInput, EstadoOT, UpdateOrdenInput } from '../types/mantenimiento';

const ORDENES_QUERY_KEY = ['ordenes'] as const;

/** Lista de OT, opcionalmente filtrada por `estado` (mismo query param que el backend). */
export function useOrdenes(estado?: EstadoOT) {
  return useQuery({
    queryKey: [...ORDENES_QUERY_KEY, estado ?? 'TODAS'],
    queryFn: () => OrdenesAPI.list(estado),
  });
}

export function useOrden(id: string | undefined) {
  return useQuery({
    queryKey: [...ORDENES_QUERY_KEY, 'detalle', id],
    queryFn: () => OrdenesAPI.getById(id as string),
    enabled: !!id,
  });
}

/**
 * Mutaciones de OT — mismo patrón que `hooks/useUsers.ts`: el feedback
 * (toast) y la invalidación viven acá, no en la vista. Como la lista se
 * consulta con distintos filtros de `estado` (ver `useOrdenes`), se invalida
 * por prefijo (`queryKey: ORDENES_QUERY_KEY`) para refrescar todas las
 * variantes cacheadas, no solo la que esté montada en ese momento.
 */
export function useCrearOrden() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateOrdenInput) => OrdenesAPI.create(input),
    onSuccess: (orden) => {
      void queryClient.invalidateQueries({ queryKey: ORDENES_QUERY_KEY });
      toast.success('Orden de trabajo creada', { description: orden.titulo });
    },
    onError: (error: unknown) => {
      toast.danger(error instanceof Error ? error.message : 'No se pudo crear la orden de trabajo.');
    },
  });
}

export function useActualizarOrden() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateOrdenInput }) =>
      OrdenesAPI.update(id, input),
    onSuccess: (orden) => {
      void queryClient.invalidateQueries({ queryKey: ORDENES_QUERY_KEY });
      toast.success('Orden de trabajo actualizada', { description: orden.titulo });
    },
    onError: (error: unknown) => {
      toast.danger(
        error instanceof Error ? error.message : 'No se pudo actualizar la orden de trabajo.',
      );
    },
  });
}

export function useToggleTarea() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ ordenId, tareaId, hecha }: { ordenId: string; tareaId: string; hecha: boolean }) =>
      OrdenesAPI.toggleTarea(ordenId, tareaId, hecha),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ORDENES_QUERY_KEY });
      toast.success('Tarea actualizada');
    },
    onError: (error: unknown) => {
      toast.danger(error instanceof Error ? error.message : 'No se pudo actualizar la tarea.');
    },
  });
}
