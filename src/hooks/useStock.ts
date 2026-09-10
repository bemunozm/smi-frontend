import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from '@heroui/react';

import { StockAPI, type StockFiltros } from '../api/StockAPI';
import type { SetStockMinimoInput } from '../types/stock';

/**
 * Cuelga de `['inventario']` a propósito: cualquier movimiento de stock que
 * invalide el inventario (los hooks de `useInventario`) tiene que invalidar
 * también esta pantalla. Si tuviera una raíz propia, registrar una salida
 * dejaría la vista por sucursal mostrando un saldo que ya no existe.
 */
const STOCK_KEY = ['inventario', 'stock'] as const;

export function useStockSucursal(filtros: StockFiltros = {}) {
  return useQuery({
    queryKey: [...STOCK_KEY, filtros],
    queryFn: () => StockAPI.listStock(filtros),
  });
}

/** Desglose de un insumo por bodega. Se pide solo al expandir la fila. */
export function useDesgloseInsumo(insumoId: string | null) {
  return useQuery({
    queryKey: [...STOCK_KEY, 'desglose', insumoId],
    queryFn: () => StockAPI.desglose(insumoId ?? ''),
    enabled: !!insumoId,
  });
}

export function useSetStockMinimo() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: SetStockMinimoInput) => StockAPI.setStockMinimo(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['inventario'] });
      toast.success('Stock mínimo actualizado');
    },
    onError: (error: unknown) => {
      toast.danger(
        error instanceof Error
          ? error.message
          : 'No se pudo actualizar el stock mínimo.',
      );
    },
  });
}
