import { useQuery } from '@tanstack/react-query';
import { toast } from '@heroui/react';

import { CategoryAPI, type CategoryFilters } from '../api/CategoryAPI';
import { conPendientes, diferenciaEdicion, precondicion } from '../lib/edit-diff';
import { INVENTORY_KEY } from '../lib/query-keys';
import { generateUuid } from '../lib/uuid';
import { categoryEntity } from '../offline/db';
import { cambiosPendientes } from '../offline/outbox';
import type { ItemCategory } from '../types/category';
import { useOfficeMutation } from './useOfficeMutation';

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
  return useOfficeMutation<'category.create', string>({
    endpoint: 'category.create',
    build: (name) => ({ params: {}, body: { name, id: generateUuid() } }),
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
  return useOfficeMutation<'category.update', UpdateCategoryVars>({
    endpoint: 'category.update',
    build: async ({ category, name }) => {
      const pendiente = await cambiosPendientes(categoryEntity(category.id), ['category.update']);
      const base = conPendientes({ name: category.name }, pendiente, ['name']);
      const { cambios, esperado } = diferenciaEdicion(base, { name }, ['name']);
      if (Object.keys(cambios).length === 0) return null;
      return { params: { id: category.id }, body: cambios, expected: precondicion(esperado) };
    },
    onSent: (category, { name }) => {
      toast.success('Categoría actualizada', { description: category?.name ?? name });
    },
    errorFallback: 'No se pudo renombrar la categoría.',
  });
}

export function useDeleteCategory() {
  return useOfficeMutation<'category.delete', string>({
    endpoint: 'category.delete',
    build: (id) => ({ params: { id }, body: {} }),
    onSent: () => {
      toast.success('Categoría eliminada');
    },
    // El 409 explica cuántos ítems la usan y que hay que reasignarlos.
    errorFallback: 'No se pudo eliminar la categoría.',
  });
}
