import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from '@heroui/react';

import {
  CompatibilidadAPI,
  type RepuestosFiltros,
} from '../api/CompatibilidadAPI';
import type { CreateCompatibilidadInput } from '../types/compatibilidad';

const COMPATIBILIDAD_KEY = ['compatibilidad'] as const;

export function useRepuestosDeEquipo(
  equipoId: string,
  filtros: RepuestosFiltros = {},
) {
  return useQuery({
    queryKey: [...COMPATIBILIDAD_KEY, 'equipo', equipoId, filtros],
    queryFn: () => CompatibilidadAPI.repuestosDeEquipo(equipoId, filtros),
    enabled: !!equipoId,
  });
}

/** En qué equipos se usa un repuesto. La pregunta de bodega. */
export function useEquiposDeInsumo(insumoId: string) {
  return useQuery({
    queryKey: [...COMPATIBILIDAD_KEY, 'insumo', insumoId],
    queryFn: () => CompatibilidadAPI.equiposDeInsumo(insumoId),
    enabled: !!insumoId,
  });
}

/**
 * Equipos del mismo marca+modelo con compatibilidades ya declaradas. Alimenta
 * el aviso de replicación; se consulta solo cuando el equipo no tiene ninguna.
 */
export function useOrigenesReplicables(equipoId: string, enabled: boolean) {
  return useQuery({
    queryKey: [...COMPATIBILIDAD_KEY, 'replicables', equipoId],
    queryFn: () => CompatibilidadAPI.origenesReplicables(equipoId),
    enabled: enabled && !!equipoId,
  });
}

function useInvalidarCompatibilidad() {
  const queryClient = useQueryClient();
  return () =>
    void queryClient.invalidateQueries({ queryKey: COMPATIBILIDAD_KEY });
}

export function useCreateCompatibilidad() {
  const invalidar = useInvalidarCompatibilidad();

  return useMutation({
    mutationFn: (input: CreateCompatibilidadInput) =>
      CompatibilidadAPI.createCompatibilidad(input),
    onSuccess: () => {
      invalidar();
      toast.success('Repuesto declarado como compatible');
    },
    onError: (error: unknown) => {
      // El 409 del backend dice QUÉ repuesto ya estaba declarado y en qué
      // máquina; ese mensaje es más útil que cualquier texto genérico.
      toast.danger(
        error instanceof Error
          ? error.message
          : 'No se pudo declarar la compatibilidad.',
      );
    },
  });
}

export function useUpdateNotaCompatibilidad() {
  const invalidar = useInvalidarCompatibilidad();

  return useMutation({
    mutationFn: ({ id, nota }: { id: string; nota: string }) =>
      CompatibilidadAPI.updateNota(id, nota),
    onSuccess: () => {
      invalidar();
      toast.success('Nota actualizada');
    },
    onError: (error: unknown) => {
      toast.danger(
        error instanceof Error
          ? error.message
          : 'No se pudo actualizar la nota.',
      );
    },
  });
}

export function useDeleteCompatibilidad() {
  const invalidar = useInvalidarCompatibilidad();

  return useMutation({
    mutationFn: (id: string) => CompatibilidadAPI.removeCompatibilidad(id),
    onSuccess: () => {
      invalidar();
      toast.success('Compatibilidad eliminada');
    },
    onError: (error: unknown) => {
      toast.danger(
        error instanceof Error
          ? error.message
          : 'No se pudo quitar la compatibilidad.',
      );
    },
  });
}

export function useReplicarCompatibilidades() {
  const invalidar = useInvalidarCompatibilidad();

  return useMutation({
    mutationFn: ({
      equipoId,
      origenId,
    }: {
      equipoId: string;
      origenId: string;
    }) => CompatibilidadAPI.replicar(equipoId, origenId),
    onSuccess: (resultado) => {
      invalidar();
      // El backend ya redacta el mensaje correcto para los dos casos válidos
      // (se copiaron todas / parte ya estaba declarada).
      toast.success(resultado.message);
    },
    onError: (error: unknown) => {
      toast.danger(
        error instanceof Error
          ? error.message
          : 'No se pudieron copiar las compatibilidades.',
      );
    },
  });
}
