import { axiosInstance } from '../lib/axios';
import { toDomainError } from '../lib/api-error';
import {
  ConsumerListResponseSchema,
  MovementListResponseSchema,
  ItemListResponseSchema,
  KardexResponseSchema,
  type InventoryItem,
  type ItemConsumer,
  type ItemType,
  type StockMovement,
} from '../types/inventory';

export interface ItemFilters {
  q?: string;
  /** Solo los ítems asignados a este equipo. */
  equipmentId?: string;
  type?: ItemType;
  categoryId?: string;
  isActive?: boolean;
}

function cleanParams(filters: object): Record<string, unknown> {
  // El backend corre con `forbidNonWhitelisted`; mandar claves vacías o
  // `undefined` haría fallar la validación del query DTO.
  return Object.fromEntries(
    Object.entries(filters).filter(
      ([, value]) => value !== undefined && value !== '',
    ),
  );
}

async function listItems(filters: ItemFilters = {}): Promise<InventoryItem[]> {
  try {
    const response = await axiosInstance.get('/api/inventory/items', {
      params: cleanParams(filters),
    });
    return ItemListResponseSchema.parse(response.data).data;
  } catch (error: unknown) {
    throw toDomainError(error, 'No se pudo obtener el inventario.');
  }
}

async function kardex(itemId: string, branchId?: string) {
  try {
    const response = await axiosInstance.get(
      `/api/inventory/items/${itemId}/kardex`,
      { params: cleanParams({ branchId }) },
    );
    return KardexResponseSchema.parse(response.data).data;
  } catch (error: unknown) {
    throw toDomainError(error, 'No se pudo obtener el kardex del ítem.');
  }
}

/** «Consumido por»: equipos que han gastado el ítem (salidas imputadas). */
async function consumers(itemId: string): Promise<ItemConsumer[]> {
  try {
    const response = await axiosInstance.get(
      `/api/inventory/items/${itemId}/consumers`,
    );
    return ConsumerListResponseSchema.parse(response.data).data;
  } catch (error: unknown) {
    throw toDomainError(error, 'No se pudo obtener el consumo del ítem.');
  }
}

export interface MovementFilters {
  branchId?: string;
  direction?: 'IN' | 'OUT';
  reason?: string;
  from?: string;
  to?: string;
  limit?: number;
}

/** Kardex general: el historial de todo el inventario, no el de un ítem. */
async function listMovements(
  filters: MovementFilters = {},
): Promise<StockMovement[]> {
  try {
    const response = await axiosInstance.get('/api/inventory/movements', {
      params: cleanParams(filters),
    });
    return MovementListResponseSchema.parse(response.data).data;
  } catch (error: unknown) {
    throw toDomainError(error, 'No se pudo obtener el historial.');
  }
}

export const InventoryAPI = {
  listMovements,
  listItems,
  kardex,
  consumers,
};
