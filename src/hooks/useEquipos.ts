import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from '@heroui/react';

import { EquipoAPI, type EquipoFiltros } from '../api/EquipoAPI';
import type {
  CreateEquipoInput,
  EstadoEquipo,
  UpdateEquipoInput,
} from '../types/equipo';

const EQUIPOS_KEY = ['equipos'] as const;

/**
 * Lista de equipos (Flota). Fuente única del dominio — la usan tanto las
 * pantallas de Flota como los formularios de Terreno (que la llaman SIN filtros
 * para poblar sus selects de equipo).
 *
 * La query key es retrocompatible a propósito: SIN filtros usa `['equipos']`
 * (la misma que ya consumían los tests y los selects de Terreno antes de que
 * existiera Flota); CON filtros agrega el objeto para cachear cada combinación
 * aparte. Así el hook de Terreno sigue funcionando sin cambiar una línea, y las
 * mutaciones de abajo (que invalidan el prefijo `['equipos']`) refrescan ambos.
 */
export function useEquipos(filtros: EquipoFiltros = {}) {
  const tieneFiltros = Object.keys(filtros).length > 0;
  return useQuery({
    queryKey: tieneFiltros ? [...EQUIPOS_KEY, filtros] : EQUIPOS_KEY,
    queryFn: () => EquipoAPI.list(filtros),
  });
}

export function useResumenFlota() {
  return useQuery({
    queryKey: [...EQUIPOS_KEY, 'resumen'],
    queryFn: EquipoAPI.resumen,
  });
}

export function useEquipo(id: string) {
  return useQuery({
    queryKey: [...EQUIPOS_KEY, id],
    queryFn: () => EquipoAPI.getById(id),
    enabled: !!id,
  });
}

/**
 * Invalida TODO el árbol `['equipos', ...]`: la lista (con o sin filtro), el
 * resumen y las fichas abiertas. Un cambio de estado mueve los tres a la vez
 * (el equipo sale de un filtro, entra en otro y cambia el conteo del resumen).
 */
function useInvalidarEquipos() {
  const queryClient = useQueryClient();
  return () => void queryClient.invalidateQueries({ queryKey: EQUIPOS_KEY });
}

export function useCreateEquipo() {
  const invalidar = useInvalidarEquipos();

  return useMutation({
    mutationFn: (input: CreateEquipoInput) => EquipoAPI.create(input),
    onSuccess: (equipo) => {
      invalidar();
      toast.success('Equipo creado', { description: `${equipo.codigo} ya está en la flota.` });
    },
    onError: (error: unknown) => {
      toast.danger(error instanceof Error ? error.message : 'No se pudo crear el equipo.');
    },
  });
}

export function useUpdateEquipo() {
  const invalidar = useInvalidarEquipos();

  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateEquipoInput }) =>
      EquipoAPI.update(id, input),
    onSuccess: (equipo) => {
      invalidar();
      toast.success('Equipo actualizado', { description: equipo.codigo });
    },
    onError: (error: unknown) => {
      toast.danger(error instanceof Error ? error.message : 'No se pudo actualizar el equipo.');
    },
  });
}

export function useUpdateEstadoEquipo() {
  const invalidar = useInvalidarEquipos();

  return useMutation({
    mutationFn: ({ id, estado }: { id: string; estado: EstadoEquipo }) =>
      EquipoAPI.updateEstado(id, estado),
    onSuccess: (equipo) => {
      invalidar();
      toast.success('Estado actualizado', { description: equipo.codigo });
    },
    onError: (error: unknown) => {
      toast.danger(error instanceof Error ? error.message : 'No se pudo actualizar el estado.');
    },
  });
}

export function useDeleteEquipo() {
  const invalidar = useInvalidarEquipos();

  return useMutation({
    mutationFn: (id: string) => EquipoAPI.remove(id),
    onSuccess: () => {
      invalidar();
      toast.success('Equipo eliminado');
    },
    onError: (error: unknown) => {
      // El backend rechaza con 409 y un mensaje que explica por qué (tiene
      // historial) y qué hacer en su lugar (pasarlo a "De baja"). Ese texto
      // llega tal cual acá — no hay que reescribirlo.
      toast.danger(error instanceof Error ? error.message : 'No se pudo eliminar el equipo.');
    },
  });
}
