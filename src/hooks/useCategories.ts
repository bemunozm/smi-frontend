import { useQuery } from '@tanstack/react-query';
import { toast } from '@heroui/react';

import { CategoryAPI, type CategoryFilters } from '../api/CategoryAPI';
import { INVENTORY_KEY } from '../lib/query-keys';
import { buildQueuedEdit } from '../lib/queued-edit';
import { categoryEntity } from '../offline/db';
import type { ItemCategory } from '../types/category';
import { useQueuedCreate, useQueuedDelete, useQueuedMutation } from './useQueuedMutation';

const CATEGORIES_KEY = [...INVENTORY_KEY, 'categories'] as const;

/**
 * Con `type`, solo las categorías que tienen ítems de esa clase — es lo que
 * necesita el filtro de la pantalla, que mira una pestaña a la vez. Sin él,
 * todas: así las ve la administración de la taxonomía, incluidas las vacías.
 */
export function useCategories(filters: CategoryFilters = {}) {
  return useQuery({
    queryKey: [...CATEGORIES_KEY, filters],
    queryFn: () => CategoryAPI.list(filters),
    // La taxonomía cambia una vez cada mucho, pero la alimenta el selector del
    // formulario de ítems: se refresca al montar para que una categoría recién
    // creada aparezca sin recargar la página.
    staleTime: 5 * 60 * 1000,
  });
}

/* Renombrar o borrar una categoría cambia lo que muestra el listado de ítems
 * (columna «Categoría»): el replay invalida `['inventory']` entero, no solo la
 * lista de categorías. */

export function useCreateCategory() {
  return useQueuedCreate<'category.create', string>({
    endpoint: 'category.create',
    build: (name, id) => ({ params: {}, body: { name, id } }),
    onSent: (category, name) => {
      toast.success('Categoría creada', { description: category?.name ?? name });
    },
    // El 409 del backend nombra la categoría con la que choca, incluso si
    // difiere solo en mayúsculas — ese detalle es el que hace entender el error.
    errorFallback: 'No se pudo crear la categoría.',
  });
}

export interface UpdateCategoryVars {
  /** La categoría tal como la muestra la pantalla: la base de la edición. */
  category: ItemCategory;
  name: string;
}

export function useUpdateCategory() {
  return useQueuedMutation<'category.update', UpdateCategoryVars>({
    endpoint: 'category.update',
    build: async ({ category, name }) => {
      const edicion = await buildQueuedEdit({
        entity: categoryEntity(category.id),
        ops: ['category.update'],
        base: { name: category.name },
        next: { name },
        fields: ['name'],
      });
      if (!edicion.hayCambios) return null;
      return { params: { id: category.id }, body: edicion.cambios, expected: edicion.esperado };
    },
    onSent: (category, { name }) => {
      toast.success('Categoría actualizada', { description: category?.name ?? name });
    },
    errorFallback: 'No se pudo renombrar la categoría.',
  });
}

export function useDeleteCategory() {
  // El 409 explica cuántos ítems la usan y que hay que reasignarlos.
  return useQueuedDelete({
    endpoint: 'category.delete',
    sentMessage: 'Categoría eliminada',
    errorFallback: 'No se pudo eliminar la categoría.',
  });
}
