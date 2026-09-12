import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from '@heroui/react';

import { CategoryAPI } from '../api/CategoryAPI';

const CATEGORIES_KEY = ['inventory', 'categories'] as const;

export function useCategories() {
  return useQuery({
    queryKey: CATEGORIES_KEY,
    queryFn: () => CategoryAPI.list(),
    // La taxonomía cambia una vez cada mucho, pero la alimenta el selector del
    // formulario de ítems: se refresca al montar para que una categoría recién
    // creada aparezca sin recargar la página.
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Renombrar o borrar una categoría cambia lo que muestra el listado de ítems
 * (columna «Categoría»), así que se invalida `['inventory']` entero y no solo
 * la lista de categorías.
 */
function useInvalidateInventory() {
  const queryClient = useQueryClient();
  return () =>
    void queryClient.invalidateQueries({ queryKey: ['inventory'] as const });
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

export function useCreateCategory() {
  const invalidate = useInvalidateInventory();

  return useMutation({
    mutationFn: (name: string) => CategoryAPI.create(name),
    onSuccess: (category) => {
      invalidate();
      toast.success('Categoría creada', { description: category.name });
    },
    onError: (error: unknown) => {
      // El 409 del backend nombra la categoría con la que choca, incluso si
      // difiere solo en mayúsculas — ese detalle es el que hace entender el error.
      toast.danger(errorMessage(error, 'No se pudo crear la categoría.'));
    },
  });
}

export function useUpdateCategory() {
  const invalidate = useInvalidateInventory();

  return useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) =>
      CategoryAPI.update(id, name),
    onSuccess: (category) => {
      invalidate();
      toast.success('Categoría actualizada', { description: category.name });
    },
    onError: (error: unknown) => {
      toast.danger(errorMessage(error, 'No se pudo renombrar la categoría.'));
    },
  });
}

export function useDeleteCategory() {
  const invalidate = useInvalidateInventory();

  return useMutation({
    mutationFn: (id: string) => CategoryAPI.remove(id),
    onSuccess: () => {
      invalidate();
      toast.success('Categoría eliminada');
    },
    onError: (error: unknown) => {
      // El 409 explica cuántos ítems la usan y que hay que reasignarlos.
      toast.danger(errorMessage(error, 'No se pudo eliminar la categoría.'));
    },
  });
}
