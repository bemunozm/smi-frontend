import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from '@heroui/react';

import { InventarioAPI, type InsumoFiltros } from '../api/InventarioAPI';
import type {
  CreateInsumoInput,
  CreateMovimientoInput,
  UpdateInsumoInput,
} from '../types/inventario';

const INVENTARIO_KEY = ['inventario'] as const;

export function useInsumos(filtros: InsumoFiltros = {}) {
  return useQuery({
    queryKey: [...INVENTARIO_KEY, 'insumos', filtros],
    queryFn: () => InventarioAPI.listInsumos(filtros),
  });
}

export function useResumenInventario() {
  return useQuery({
    queryKey: [...INVENTARIO_KEY, 'resumen'],
    queryFn: InventarioAPI.resumen,
  });
}

export function useKardex(insumoId: string) {
  return useQuery({
    queryKey: [...INVENTARIO_KEY, 'kardex', insumoId],
    queryFn: () => InventarioAPI.kardex(insumoId),
    enabled: !!insumoId,
  });
}

/**
 * Invalida todo `['inventario', ...]`. Cualquier movimiento cambia a la vez el
 * stock del listado, el conteo de bajo mínimo del resumen y el kardex del
 * insumo — invalidar solo una de las tres dejaría la pantalla mostrando cifras
 * que ya no cuadran entre sí.
 */
function useInvalidarInventario() {
  const queryClient = useQueryClient();
  return () => void queryClient.invalidateQueries({ queryKey: INVENTARIO_KEY });
}

export function useCreateInsumo() {
  const invalidar = useInvalidarInventario();

  return useMutation({
    mutationFn: (input: CreateInsumoInput) => InventarioAPI.createInsumo(input),
    onSuccess: (insumo) => {
      invalidar();
      toast.success('Insumo creado', { description: `${insumo.codigo} · ${insumo.nombre}` });
    },
    onError: (error: unknown) => {
      toast.danger(error instanceof Error ? error.message : 'No se pudo crear el insumo.');
    },
  });
}

export function useUpdateInsumo() {
  const invalidar = useInvalidarInventario();

  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateInsumoInput }) =>
      InventarioAPI.updateInsumo(id, input),
    onSuccess: (insumo) => {
      invalidar();
      toast.success('Insumo actualizado', { description: insumo.nombre });
    },
    onError: (error: unknown) => {
      toast.danger(error instanceof Error ? error.message : 'No se pudo actualizar el insumo.');
    },
  });
}

export function useDeleteInsumo() {
  const invalidar = useInvalidarInventario();

  return useMutation({
    mutationFn: (id: string) => InventarioAPI.removeInsumo(id),
    onSuccess: () => {
      invalidar();
      toast.success('Insumo eliminado');
    },
    onError: (error: unknown) => {
      toast.danger(error instanceof Error ? error.message : 'No se pudo eliminar el insumo.');
    },
  });
}

export function useCreateMovimiento() {
  const invalidar = useInvalidarInventario();

  return useMutation({
    mutationFn: (input: CreateMovimientoInput) => InventarioAPI.createMovimiento(input),
    onSuccess: (movimiento) => {
      invalidar();
      toast.success('Movimiento registrado', {
        description: `Saldo resultante: ${movimiento.saldoResultante}`,
      });
    },
    onError: (error: unknown) => {
      // El 409 por stock insuficiente trae el detalle exacto (disponible vs
      // solicitado) desde el backend; se muestra tal cual.
      toast.danger(error instanceof Error ? error.message : 'No se pudo registrar el movimiento.');
    },
  });
}

export function useAjustarStock() {
  const invalidar = useInvalidarInventario();

  return useMutation({
    mutationFn: ({
      id,
      input,
    }: {
      id: string;
      input: { stockContado: number; observacion?: string };
    }) => InventarioAPI.ajustarStock(id, input),
    onSuccess: (resultado) => {
      invalidar();
      // Dos resultados válidos: hubo diferencia (movimiento) o el conteo
      // coincidía. El backend ya redacta el mensaje correcto para cada caso.
      if (resultado.movimiento) {
        toast.success(resultado.message, {
          description: `${resultado.insumo.nombre}: stock ahora en ${resultado.insumo.stock}`,
        });
      } else {
        toast.info(resultado.message);
      }
    },
    onError: (error: unknown) => {
      toast.danger(error instanceof Error ? error.message : 'No se pudo ajustar el stock.');
    },
  });
}
