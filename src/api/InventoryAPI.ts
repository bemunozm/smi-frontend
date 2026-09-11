import { axiosInstance } from '../lib/axios';
import { toDomainError } from '../lib/api-error';
import {
  AdjustResponseSchema,
  DeleteItemResponseSchema,
  ItemListResponseSchema,
  ItemResponseSchema,
  KardexResponseSchema,
  MovementResponseSchema,
  type AdjustStockInput,
  type CreateItemInput,
  type CreateMovementInput,
  type InventoryItem,
  type ItemType,
  type StockMovement,
  type UpdateItemInput,
} from '../types/inventory';

export interface ItemFilters {
  q?: string;
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

async function createItem(input: CreateItemInput): Promise<InventoryItem> {
  try {
    const response = await axiosInstance.post('/api/inventory/items', input);
    return ItemResponseSchema.parse(response.data).data;
  } catch (error: unknown) {
    throw toDomainError(error, 'No se pudo crear el ítem.');
  }
}

async function updateItem(
  id: string,
  input: UpdateItemInput,
): Promise<InventoryItem> {
  try {
    const response = await axiosInstance.patch(
      `/api/inventory/items/${id}`,
      input,
    );
    return ItemResponseSchema.parse(response.data).data;
  } catch (error: unknown) {
    throw toDomainError(error, 'No se pudo actualizar el ítem.');
  }
}

async function removeItem(id: string): Promise<void> {
  try {
    const response = await axiosInstance.delete(`/api/inventory/items/${id}`);
    DeleteItemResponseSchema.parse(response.data);
  } catch (error: unknown) {
    throw toDomainError(error, 'No se pudo eliminar el ítem.');
  }
}

interface AdjustResult {
  item: InventoryItem;
  movement: StockMovement | null;
  message: string;
}

/** Conteo físico: el backend calcula la diferencia y registra el asiento. */
async function adjustStock(
  id: string,
  input: AdjustStockInput,
): Promise<AdjustResult> {
  try {
    const response = await axiosInstance.post(
      `/api/inventory/items/${id}/adjust`,
      input,
    );
    const parsed = AdjustResponseSchema.parse(response.data);
    // El `message` viaja hasta el hook porque distingue dos resultados válidos:
    // "existencia ajustada" y "el conteo coincidía, no se movió nada".
    return { ...parsed.data, message: parsed.message };
  } catch (error: unknown) {
    throw toDomainError(error, 'No se pudo ajustar la existencia.');
  }
}

async function createMovement(
  input: CreateMovementInput,
): Promise<StockMovement> {
  try {
    const response = await axiosInstance.post(
      '/api/inventory/movements',
      input,
    );
    return MovementResponseSchema.parse(response.data).data;
  } catch (error: unknown) {
    throw toDomainError(error, 'No se pudo registrar el movimiento.');
  }
}

async function setMinimum(input: {
  itemId: string;
  branchId: string;
  minimumQuantity: number;
}): Promise<void> {
  try {
    await axiosInstance.put('/api/inventory/stock/minimum', input);
  } catch (error: unknown) {
    throw toDomainError(error, 'No se pudo actualizar el stock mínimo.');
  }
}

async function transfer(input: {
  itemId: string;
  sourceBranchId: string;
  destinationBranchId: string;
  quantity: number;
  notes?: string;
}): Promise<string> {
  try {
    const response = await axiosInstance.post(
      '/api/inventory/stock/transfer',
      input,
    );
    // El backend redacta el resumen del traspaso ("12 de Casa Matriz a Faena"),
    // que es más informativo que cualquier texto que arme el cliente.
    const message: unknown = (response.data as { message?: unknown }).message;
    return typeof message === 'string' ? message : 'Traspaso registrado';
  } catch (error: unknown) {
    throw toDomainError(error, 'No se pudo registrar el traspaso.');
  }
}

export const InventoryAPI = {
  listItems,
  kardex,
  createItem,
  updateItem,
  removeItem,
  adjustStock,
  createMovement,
  setMinimum,
  transfer,
};
