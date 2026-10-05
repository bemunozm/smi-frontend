import { useQuery } from '@tanstack/react-query';
import { toast } from '@heroui/react';

import {
  InventoryAPI,
  type ItemFilters,
  type MovementFilters,
} from '../api/InventoryAPI';
import { DomainError } from '../lib/api-error';
import { mensajeErrorFormulario } from '../lib/error-messages';
import { conPendientes, diferenciaEdicion, precondicion } from '../lib/edit-diff';
import { INVENTORY_KEY } from '../lib/query-keys';
import { existenciaConPendientes } from '../lib/stock-pending';
import { generateUuid } from '../lib/uuid';
import { itemEntity } from '../offline/db';
import type { SetMinimumBody, TransferStockBody } from '../offline/endpoints/inventario';
import { cambiosPendientes, escriturasPendientes } from '../offline/outbox';
import {
  UNIT_SYMBOLS,
  type AdjustStockInput,
  type CreateItemInput,
  type CreateMovementInput,
  type ItemFields,
  type InventoryItem,
  type UpdateItemInput,
} from '../types/inventory';
import { useOfficeMutation } from './useOfficeMutation';

export function useItems(filters: ItemFilters = {}) {
  return useQuery({
    queryKey: [...INVENTORY_KEY, 'items', filters],
    queryFn: () => InventoryAPI.listItems(filters),
  });
}

/**
 * Historial de TODO el inventario. Comparte la raíz `['inventory']` con el
 * resto para que cualquier movimiento lo invalide junto con los saldos: si el
 * listado se actualiza y el historial no, quedan contándose cosas distintas.
 */
export function useMovements(filters: MovementFilters = {}) {
  return useQuery({
    queryKey: [...INVENTORY_KEY, 'movements', filters],
    queryFn: () => InventoryAPI.listMovements(filters),
  });
}

export function useKardex(itemId: string | null, branchId?: string) {
  return useQuery({
    queryKey: [...INVENTORY_KEY, 'kardex', itemId, branchId ?? null],
    queryFn: () => InventoryAPI.kardex(itemId ?? '', branchId),
    enabled: !!itemId,
  });
}

/* Las escrituras van por la cola (`useOfficeMutation`). Al terminar, el replay
 * invalida todo `['inventory', ...]`: cualquier movimiento cambia a la vez el
 * saldo del listado y el kardex del ítem; invalidar solo uno dejaría la
 * pantalla mostrando cifras que ya no cuadran entre sí. */

export function useCreateItem() {
  return useOfficeMutation<'item.create', CreateItemInput>({
    endpoint: 'item.create',
    build: (input) => ({ params: {}, body: { ...input, id: generateUuid() } }),
    onSent: (item, input) => {
      toast.success('Ítem creado', { description: item ? `${item.sku} · ${item.name}` : `${input.sku} · ${input.name}` });
    },
    errorFallback: 'No se pudo crear el ítem.',
  });
}

const CAMPOS_DE_ITEM = [
  'name',
  'description',
  'unit',
  'type',
  'categoryId',
  'partNumber',
  'defaultSupplier',
  'isCritical',
  'isActive',
] as const satisfies readonly (keyof ItemFields)[];

export interface UpdateItemVars {
  /** El ítem tal como lo muestra la pantalla: la base de la edición. */
  item: InventoryItem;
  input: UpdateItemInput;
}

export function useUpdateItem() {
  return useOfficeMutation<'item.update', UpdateItemVars>({
    endpoint: 'item.update',
    build: async ({ item, input }) => {
      const pendiente = await cambiosPendientes(itemEntity(item.id), ['item.update']);
      const base = conPendientes<ItemFields>(
        {
          name: item.name,
          description: item.description,
          unit: item.unit,
          type: item.type,
          categoryId: item.categoryId,
          partNumber: item.partNumber,
          defaultSupplier: item.defaultSupplier,
          isCritical: item.isCritical,
          isActive: item.isActive,
        },
        pendiente,
        CAMPOS_DE_ITEM,
      );
      // Un texto vacío no se manda (el formulario lo omite): no se puede limpiar
      // desde acá, así que "omitido" es "sin cambio", no "borrar".
      const nuevo: ItemFields = {
        name: input.name,
        unit: input.unit,
        type: input.type,
        isCritical: input.isCritical ?? base.isCritical,
        isActive: input.isActive ?? base.isActive,
        categoryId: input.categoryId === undefined ? base.categoryId : input.categoryId,
        description: input.description ?? base.description,
        partNumber: input.partNumber ?? base.partNumber,
        defaultSupplier: input.defaultSupplier ?? base.defaultSupplier,
      };
      const { cambios, esperado } = diferenciaEdicion(base, nuevo, CAMPOS_DE_ITEM);
      if (Object.keys(cambios).length === 0) return null;
      return { params: { id: item.id }, body: cambios, expected: precondicion(esperado) };
    },
    onSent: (data, { item }) => {
      toast.success('Ítem actualizado', { description: data?.name ?? item.name });
    },
    errorFallback: 'No se pudo actualizar el ítem.',
  });
}

export function useDeleteItem() {
  return useOfficeMutation<'item.delete', string>({
    endpoint: 'item.delete',
    build: (id) => ({ params: { id }, body: {} }),
    onSent: () => {
      toast.success('Ítem eliminado');
    },
    // El 409 del backend explica que tiene kardex y sugiere la baja lógica;
    // ese mensaje es más útil que cualquier texto genérico.
    errorFallback: 'No se pudo eliminar el ítem.',
  });
}

/**
 * Entrada o salida manual. El aviso de mínimo se da **en el momento de la
 * acción**: si la salida deja la bodega en o bajo su umbral, el toast lo dice.
 * Esperar a que el usuario mire la fila pintada es tarde — ya se llevó el
 * material. Solo es posible si el servidor alcanzó a responder; encolado, no hay
 * un saldo resultante que mostrar.
 */
export function useCreateMovement() {
  return useOfficeMutation<'movement.create', { input: CreateMovementInput; item: InventoryItem }>({
    endpoint: 'movement.create',
    build: ({ input }) => ({ params: {}, body: { ...input, id: generateUuid() } }),
    onSent: (movement, { item }) => {
      if (!movement) {
        toast.success('Movimiento registrado');
        return;
      }
      const symbol = UNIT_SYMBOLS[item.unit];
      const minimum =
        item.stocks.find((stock) => stock.branchId === movement.branchId)?.minimumQuantity ?? 0;

      if (minimum > 0 && movement.resultingBalance <= minimum) {
        toast.warning('Movimiento registrado · quedaste bajo el mínimo', {
          description: `Quedan ${movement.resultingBalance} ${symbol} y el mínimo de esta bodega es ${minimum}.`,
        });
        return;
      }

      toast.success('Movimiento registrado', {
        description: `Saldo en esta bodega: ${movement.resultingBalance} ${symbol}`,
      });
    },
    // El 409 por existencia insuficiente (`INSUFFICIENT_STOCK`) llega con su texto.
    errorFallback: 'No se pudo registrar el movimiento.',
  });
}

export interface AdjustStockVars {
  id: string;
  /** `expectedQuantity` = la existencia que se veía al empezar a contar. */
  input: AdjustStockInput;
}

export function useAdjustStock() {
  return useOfficeMutation<'item.adjust', AdjustStockVars>({
    endpoint: 'item.adjust',
    build: async ({ id, input }) => {
      // Lo que ya tengo guardado sin enviar mueve la existencia antes de que
      // llegue este conteo: se declara la que habrá, no la que se ve.
      const pendientes = await escriturasPendientes(itemEntity(id), [
        'movement.create',
        'stock.transfer',
        'item.adjust',
      ]);
      const expectedQuantity =
        input.expectedQuantity === undefined
          ? undefined
          : existenciaConPendientes(input.expectedQuantity, input.branchId, pendientes);
      return {
        params: { id },
        body: { ...input, ...(expectedQuantity === undefined ? {} : { expectedQuantity }), id: generateUuid() },
      };
    },
    onSent: (result) => {
      // Dos resultados válidos: hubo diferencia, o el conteo coincidía.
      if (result?.movement) {
        toast.success('Existencia ajustada', {
          description: `${result.item.name}: saldo ahora en ${result.movement.resultingBalance}`,
        });
      } else {
        toast.info('El conteo coincide con la existencia registrada: no se movió nada.');
      }
    },
    errorFallback: 'No se pudo ajustar la existencia.',
    errorMessage: (error) =>
      error instanceof DomainError && error.code === 'STALE_UPDATE'
        ? 'Alguien movió el stock de este ítem mientras contabas. Revisá la existencia actual y volvé a contar.'
        : mensajeErrorFormulario(error, 'No se pudo ajustar la existencia.'),
  });
}

export interface SetMinimumVars {
  input: SetMinimumBody;
  /** Operaciones que deben terminar antes (p. ej. la edición del mismo ítem). */
  dependsOn?: string[];
}

/** Fija el umbral de una bodega (`PUT`, last-write-wins). */
export function useSetMinimum() {
  return useOfficeMutation<'item.setMinimum', SetMinimumVars>({
    endpoint: 'item.setMinimum',
    build: ({ input, dependsOn }) => ({ params: {}, body: input, dependsOn }),
    onSent: (_data, { input }) => {
      toast.success(
        input.minimumQuantity > 0 ? 'Stock mínimo actualizado' : 'Esta bodega ya no alerta por este ítem',
      );
    },
    errorFallback: 'No se pudo actualizar el mínimo.',
  });
}

export function useTransferStock() {
  return useOfficeMutation<'stock.transfer', TransferStockBody>({
    endpoint: 'stock.transfer',
    build: (input) => ({ params: {}, body: { ...input, id: generateUuid() } }),
    onSent: (result) => {
      toast.success(
        result
          ? `Traspaso registrado: de ${result.sourceBranchName} a ${result.destinationBranchName}`
          : 'Traspaso registrado',
      );
    },
    errorFallback: 'No se pudo registrar el traspaso.',
  });
}
