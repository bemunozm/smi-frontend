import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from '@heroui/react';

import { InventoryAPI, type ItemFilters } from '../api/InventoryAPI';
import {
  UNIT_SYMBOLS,
  type AdjustStockInput,
  type CreateItemInput,
  type CreateMovementInput,
  type InventoryItem,
  type UpdateItemInput,
} from '../types/inventory';

const INVENTORY_KEY = ['inventory'] as const;

export function useItems(filters: ItemFilters = {}) {
  return useQuery({
    queryKey: [...INVENTORY_KEY, 'items', filters],
    queryFn: () => InventoryAPI.listItems(filters),
  });
}

export function useKardex(itemId: string | null, branchId?: string) {
  return useQuery({
    queryKey: [...INVENTORY_KEY, 'kardex', itemId, branchId ?? null],
    queryFn: () => InventoryAPI.kardex(itemId ?? '', branchId),
    enabled: !!itemId,
  });
}

/**
 * Invalida todo `['inventory', ...]`. Cualquier movimiento cambia a la vez el
 * saldo del listado y el kardex del ítem; invalidar solo uno dejaría la
 * pantalla mostrando cifras que ya no cuadran entre sí.
 */
function useInvalidateInventory() {
  const queryClient = useQueryClient();
  return () => void queryClient.invalidateQueries({ queryKey: INVENTORY_KEY });
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

export function useCreateItem() {
  const invalidate = useInvalidateInventory();

  return useMutation({
    mutationFn: (input: CreateItemInput) => InventoryAPI.createItem(input),
    onSuccess: (item) => {
      invalidate();
      toast.success('Ítem creado', { description: `${item.sku} · ${item.name}` });
    },
    onError: (error: unknown) => {
      toast.danger(errorMessage(error, 'No se pudo crear el ítem.'));
    },
  });
}

export function useUpdateItem() {
  const invalidate = useInvalidateInventory();

  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateItemInput }) =>
      InventoryAPI.updateItem(id, input),
    onSuccess: (item) => {
      invalidate();
      toast.success('Ítem actualizado', { description: item.name });
    },
    onError: (error: unknown) => {
      toast.danger(errorMessage(error, 'No se pudo actualizar el ítem.'));
    },
  });
}

export function useDeleteItem() {
  const invalidate = useInvalidateInventory();

  return useMutation({
    mutationFn: (id: string) => InventoryAPI.removeItem(id),
    onSuccess: () => {
      invalidate();
      toast.success('Ítem eliminado');
    },
    onError: (error: unknown) => {
      // El 409 del backend explica que tiene kardex y sugiere la baja lógica;
      // ese mensaje es más útil que cualquier texto genérico.
      toast.danger(errorMessage(error, 'No se pudo eliminar el ítem.'));
    },
  });
}

/**
 * Entrada o salida manual. El aviso de mínimo se da **en el momento de la
 * acción**: si la salida deja la bodega en o bajo su umbral, el toast lo dice.
 * Esperar a que el usuario mire la fila pintada es tarde — ya se llevó el
 * material.
 */
export function useCreateMovement() {
  const invalidate = useInvalidateInventory();

  return useMutation({
    mutationFn: ({
      input,
      item,
    }: {
      input: CreateMovementInput;
      item: InventoryItem;
    }) => InventoryAPI.createMovement(input).then((movement) => ({ movement, item })),
    onSuccess: ({ movement, item }) => {
      invalidate();
      const symbol = UNIT_SYMBOLS[item.unit];
      const minimum =
        item.stocks.find((stock) => stock.branchId === movement.branchId)
          ?.minimumQuantity ?? 0;

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
    onError: (error: unknown) => {
      // El 409 por existencia insuficiente trae el detalle exacto (disponible
      // vs. solicitado, y cuánto hay en otras sucursales) — se muestra tal cual.
      toast.danger(errorMessage(error, 'No se pudo registrar el movimiento.'));
    },
  });
}

export function useAdjustStock() {
  const invalidate = useInvalidateInventory();

  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: AdjustStockInput }) =>
      InventoryAPI.adjustStock(id, input),
    onSuccess: (result) => {
      invalidate();
      // Dos resultados válidos: hubo diferencia, o el conteo coincidía. El
      // backend ya redacta el mensaje correcto para cada caso.
      if (result.movement) {
        toast.success(result.message, {
          description: `${result.item.name}: saldo ahora en ${result.movement.resultingBalance}`,
        });
      } else {
        toast.info(result.message);
      }
    },
    onError: (error: unknown) => {
      toast.danger(errorMessage(error, 'No se pudo ajustar la existencia.'));
    },
  });
}

export function useSetMinimum() {
  const invalidate = useInvalidateInventory();

  return useMutation({
    mutationFn: (input: {
      itemId: string;
      branchId: string;
      minimumQuantity: number;
    }) => InventoryAPI.setMinimum(input),
    onSuccess: (_data, input) => {
      invalidate();
      toast.success(
        input.minimumQuantity > 0
          ? 'Stock mínimo actualizado'
          : 'Esta bodega ya no alerta por este ítem',
      );
    },
    onError: (error: unknown) => {
      toast.danger(errorMessage(error, 'No se pudo actualizar el mínimo.'));
    },
  });
}

export function useTransferStock() {
  const invalidate = useInvalidateInventory();

  return useMutation({
    mutationFn: (input: {
      itemId: string;
      sourceBranchId: string;
      destinationBranchId: string;
      quantity: number;
      documentNumber?: string;
      notes?: string;
    }) => InventoryAPI.transfer(input),
    onSuccess: (message) => {
      invalidate();
      toast.success(message);
    },
    onError: (error: unknown) => {
      toast.danger(errorMessage(error, 'No se pudo registrar el traspaso.'));
    },
  });
}
