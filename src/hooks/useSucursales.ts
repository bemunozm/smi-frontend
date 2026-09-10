import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from '@heroui/react';

import { SucursalAPI, type SucursalFiltros } from '../api/SucursalAPI';
import type { CreateSucursalInput } from '../types/sucursal';

const SUCURSALES_KEY = ['sucursales'] as const;

export function useSucursales(filtros: SucursalFiltros = {}) {
  return useQuery({
    queryKey: [...SUCURSALES_KEY, filtros],
    queryFn: () => SucursalAPI.listSucursales(filtros),
    // El maestro de bodegas cambia con muy baja frecuencia y lo consulta cada
    // pantalla de inventario: refetchearlo en cada foco sería ruido de red.
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Invalida `['sucursales']` y también `['inventario']`: marcar una bodega como
 * principal o desactivarla cambia lo que muestra la pantalla de stock, no solo
 * el selector.
 */
function useInvalidarSucursales() {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: SUCURSALES_KEY });
    void queryClient.invalidateQueries({ queryKey: ['inventario'] });
  };
}

export function useCreateSucursal() {
  const invalidar = useInvalidarSucursales();

  return useMutation({
    mutationFn: (input: CreateSucursalInput) =>
      SucursalAPI.createSucursal(input),
    onSuccess: (sucursal) => {
      invalidar();
      toast.success('Sucursal creada', {
        description: `${sucursal.codigo} · ${sucursal.nombre}`,
      });
    },
    onError: (error: unknown) => {
      toast.danger(
        error instanceof Error ? error.message : 'No se pudo crear la sucursal.',
      );
    },
  });
}

export function useUpdateSucursal() {
  const invalidar = useInvalidarSucursales();

  return useMutation({
    mutationFn: ({
      id,
      input,
    }: {
      id: string;
      input: Partial<{
        nombre: string;
        direccion: string;
        activa: boolean;
        esPrincipal: boolean;
      }>;
    }) => SucursalAPI.updateSucursal(id, input),
    onSuccess: (sucursal) => {
      invalidar();
      toast.success('Sucursal actualizada', { description: sucursal.nombre });
    },
    onError: (error: unknown) => {
      // El backend explica por qué no se puede (p. ej. "es la principal");
      // ese mensaje es más útil que cualquier texto genérico.
      toast.danger(
        error instanceof Error
          ? error.message
          : 'No se pudo actualizar la sucursal.',
      );
    },
  });
}

export function useDeleteSucursal() {
  const invalidar = useInvalidarSucursales();

  return useMutation({
    mutationFn: (id: string) => SucursalAPI.removeSucursal(id),
    onSuccess: () => {
      invalidar();
      toast.success('Sucursal eliminada');
    },
    onError: (error: unknown) => {
      toast.danger(
        error instanceof Error
          ? error.message
          : 'No se pudo eliminar la sucursal.',
      );
    },
  });
}
