import { ItemCategorySchema, type ItemCategory } from '../../types/category';
import {
  AdjustResultSchema,
  TransferResultSchema,
  InventoryItemSchema,
  StockMovementSchema,
  type AdjustResult,
  type AdjustStockInput,
  type CreateItemInput,
  type CreateMovementInput,
  type InventoryItem,
  type ItemFields,
  type StockMovement,
  type TransferResult,
} from '../../types/inventory';
import type { JsonObject } from '../../types/json';
import { cachedName } from '../cache-upserts';
import { categoryEntity, itemEntity } from '../db';
import {
  aceptarCualquiera,
  bodyText,
  defineEndpoint,
  etiqueta,
  param,
  parseWith,
  type DomainRegistry,
  type NoParams,
  type WithId,
} from './define';

export interface TransferStockBody {
  itemId: string;
  sourceBranchId: string;
  destinationBranchId: string;
  quantity: number;
  documentNumber?: string;
  notes?: string;
}

export interface SetMinimumBody {
  itemId: string;
  branchId: string;
  minimumQuantity: number;
}

export interface InventarioEndpointMap {
  'item.create': { params: NoParams; body: WithId<CreateItemInput>; result: InventoryItem };
  'item.update': { params: { id: string }; body: Partial<ItemFields>; result: InventoryItem };
  'item.delete': { params: { id: string }; body: NoParams; result: true };
  /** El `id` es el del movimiento que genera el conteo, no el del ítem. */
  'item.adjust': { params: { id: string }; body: WithId<AdjustStockInput>; result: AdjustResult };
  /** Fija el umbral de una bodega (`PUT`, last-write-wins). */
  'item.setMinimum': { params: NoParams; body: SetMinimumBody; result: true };
  'movement.create': { params: NoParams; body: WithId<CreateMovementInput>; result: StockMovement };
  /** El `id` es el del movimiento de salida del traspaso. */
  'stock.transfer': { params: NoParams; body: WithId<TransferStockBody>; result: TransferResult };
  'category.create': { params: NoParams; body: WithId<{ name: string }>; result: ItemCategory };
  'category.update': { params: { id: string }; body: { name?: string }; result: ItemCategory };
  'category.delete': { params: { id: string }; body: NoParams; result: true };
}

/** El ítem agrupa todo lo que toca su existencia: un conteo, un movimiento o un
 * mínimo no se mandan por delante de una edición suya que siga esperando. */
function itemDelBody(body: JsonObject): string | undefined {
  const itemId = bodyText(body, 'itemId');
  return itemId ? itemEntity(itemId) : undefined;
}

export const INVENTARIO_ENDPOINTS: DomainRegistry<InventarioEndpointMap> = {
  'item.create': defineEndpoint({
    method: 'POST',
    path: () => '/api/inventory/items',
    failMessage: 'No se pudo crear el ítem.',
    parse: parseWith(InventoryItemSchema),
    invalidate: ['inventory'],
    label: (_params, body) => etiqueta('Nuevo ítem', bodyText(body, 'name')),
    notFoundIsDone: false,
    carriesFiles: false,
    creates: true,
    entity: (_params, body) => {
      const id = bodyText(body, 'id');
      return id ? itemEntity(id) : undefined;
    },
  }),
  'item.update': defineEndpoint({
    method: 'PATCH',
    path: (params) => `/api/inventory/items/${param(params, 'id')}`,
    failMessage: 'No se pudo actualizar el ítem.',
    parse: parseWith(InventoryItemSchema),
    invalidate: ['inventory'],
    label: (params) => etiqueta('Edición de ítem', cachedName('item', params.id ?? '')),
    notFoundIsDone: false,
    carriesFiles: false,
    entity: (params) => (params.id ? itemEntity(params.id) : undefined),
  }),
  'item.delete': defineEndpoint({
    method: 'DELETE',
    path: (params) => `/api/inventory/items/${param(params, 'id')}`,
    failMessage: 'No se pudo eliminar el ítem.',
    parse: aceptarCualquiera,
    invalidate: ['inventory'],
    label: (params) => etiqueta('Eliminación de ítem', cachedName('item', params.id ?? '')),
    notFoundIsDone: true,
    carriesFiles: false,
    entity: (params) => (params.id ? itemEntity(params.id) : undefined),
  }),
  'item.adjust': defineEndpoint({
    method: 'POST',
    path: (params) => `/api/inventory/items/${param(params, 'id')}/adjust`,
    failMessage: 'No se pudo ajustar la existencia.',
    parse: parseWith(AdjustResultSchema),
    invalidate: ['inventory'],
    label: (params) => etiqueta('Conteo físico', cachedName('item', params.id ?? '')),
    notFoundIsDone: false,
    carriesFiles: false,
    entity: (params) => (params.id ? itemEntity(params.id) : undefined),
  }),
  'item.setMinimum': defineEndpoint({
    method: 'PUT',
    path: () => '/api/inventory/stock/minimum',
    failMessage: 'No se pudo actualizar el stock mínimo.',
    parse: aceptarCualquiera,
    invalidate: ['inventory'],
    label: (_params, body) => etiqueta('Stock mínimo', cachedName('item', bodyText(body, 'itemId') ?? '')),
    notFoundIsDone: false,
    carriesFiles: false,
    entity: (_params, body) => itemDelBody(body),
  }),
  'movement.create': defineEndpoint({
    method: 'POST',
    path: () => '/api/inventory/movements',
    failMessage: 'No se pudo registrar el movimiento.',
    parse: parseWith(StockMovementSchema),
    invalidate: ['inventory', 'equipment'],
    label: (_params, body) => etiqueta('Movimiento de stock', cachedName('item', bodyText(body, 'itemId') ?? '')),
    notFoundIsDone: false,
    carriesFiles: false,
    entity: (_params, body) => itemDelBody(body),
  }),
  'stock.transfer': defineEndpoint({
    method: 'POST',
    path: () => '/api/inventory/stock/transfer',
    failMessage: 'No se pudo registrar el traspaso.',
    parse: parseWith(TransferResultSchema),
    invalidate: ['inventory'],
    label: (_params, body) => etiqueta('Traspaso de stock', cachedName('item', bodyText(body, 'itemId') ?? '')),
    notFoundIsDone: false,
    carriesFiles: false,
    entity: (_params, body) => itemDelBody(body),
  }),
  'category.create': defineEndpoint({
    method: 'POST',
    path: () => '/api/inventory/categories',
    failMessage: 'No se pudo crear la categoría.',
    parse: parseWith(ItemCategorySchema),
    invalidate: ['inventory'],
    label: (_params, body) => etiqueta('Nueva categoría', bodyText(body, 'name')),
    notFoundIsDone: false,
    carriesFiles: false,
    creates: true,
    entity: (_params, body) => {
      const id = bodyText(body, 'id');
      return id ? categoryEntity(id) : undefined;
    },
  }),
  'category.update': defineEndpoint({
    method: 'PATCH',
    path: (params) => `/api/inventory/categories/${param(params, 'id')}`,
    failMessage: 'No se pudo renombrar la categoría.',
    parse: parseWith(ItemCategorySchema),
    invalidate: ['inventory'],
    label: (params) => etiqueta('Edición de categoría', cachedName('category', params.id ?? '')),
    notFoundIsDone: false,
    carriesFiles: false,
    entity: (params) => (params.id ? categoryEntity(params.id) : undefined),
  }),
  'category.delete': defineEndpoint({
    method: 'DELETE',
    path: (params) => `/api/inventory/categories/${param(params, 'id')}`,
    failMessage: 'No se pudo eliminar la categoría.',
    parse: aceptarCualquiera,
    invalidate: ['inventory'],
    label: (params) => etiqueta('Eliminación de categoría', cachedName('category', params.id ?? '')),
    notFoundIsDone: true,
    carriesFiles: false,
    entity: (params) => (params.id ? categoryEntity(params.id) : undefined),
  }),
};
