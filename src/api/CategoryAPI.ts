import { axiosInstance } from '../lib/axios';
import { toDomainError } from '../lib/api-error';
import {
  CategoryListResponseSchema,
  CategoryResponseSchema,
  DeleteCategoryResponseSchema,
  type ItemCategory,
} from '../types/category';
import type { ItemType } from '../types/inventory';

export interface CategoryFilters {
  q?: string;
  /**
   * Deja solo las categorías con ítems de ese tipo. Lo usa el filtro de la
   * pantalla, que mira una pestaña a la vez; la administración de la taxonomía
   * lo omite a propósito para ver también las vacías.
   */
  type?: ItemType;
}

async function list(filters: CategoryFilters = {}): Promise<ItemCategory[]> {
  try {
    const response = await axiosInstance.get('/api/inventory/categories', {
      // El backend corre con `forbidNonWhitelisted`: una clave vacía haría
      // fallar la validación del query DTO, así que se omiten.
      params: {
        ...(filters.q?.trim() ? { q: filters.q.trim() } : {}),
        ...(filters.type ? { type: filters.type } : {}),
      },
    });
    return CategoryListResponseSchema.parse(response.data).data;
  } catch (error: unknown) {
    throw toDomainError(error, 'No se pudieron obtener las categorías.');
  }
}

async function create(name: string): Promise<ItemCategory> {
  try {
    const response = await axiosInstance.post('/api/inventory/categories', {
      name,
    });
    return CategoryResponseSchema.parse(response.data).data;
  } catch (error: unknown) {
    throw toDomainError(error, 'No se pudo crear la categoría.');
  }
}

async function update(id: string, name: string): Promise<ItemCategory> {
  try {
    const response = await axiosInstance.patch(
      `/api/inventory/categories/${id}`,
      { name },
    );
    return CategoryResponseSchema.parse(response.data).data;
  } catch (error: unknown) {
    throw toDomainError(error, 'No se pudo renombrar la categoría.');
  }
}

async function remove(id: string): Promise<void> {
  try {
    const response = await axiosInstance.delete(
      `/api/inventory/categories/${id}`,
    );
    DeleteCategoryResponseSchema.parse(response.data);
  } catch (error: unknown) {
    throw toDomainError(error, 'No se pudo eliminar la categoría.');
  }
}

export const CategoryAPI = { list, create, update, remove };
