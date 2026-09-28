import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from '@heroui/react';

import { OperatorAPI, type OperatorFiltros } from '../api/OperatorAPI';
import type { CreateOperatorInput, UpdateOperatorInput } from '../types/operator';

// Exportada: `components/terreno/SyncStatus.tsx` la usa para refetchear el
// catálogo al "Preparar para uso sin señal" (RFC "Supervisión en Terreno"
// §Diseño → Offline), sin repetir el literal `['operators']` a mano.
export const OPERATORS_KEY = ['operators'] as const;

/**
 * Lista de operadores — mismo patrón retrocompatible que `useBranches`/
 * `useUsers`: sin filtros usa `['operators']` (la key que consume
 * `OperadoresView`), con filtros agrega el objeto aparte, así el picker
 * (`OperatorPicker`, `useOperators({ isActive: true })`) cachea aparte de la
 * lista completa de administración.
 */
export function useOperators(filtros: OperatorFiltros = {}) {
  const tieneFiltros = Object.keys(filtros).length > 0;
  return useQuery({
    queryKey: tieneFiltros ? [...OPERATORS_KEY, filtros] : OPERATORS_KEY,
    queryFn: () => OperatorAPI.list(filtros),
  });
}

function useInvalidarOperators() {
  const queryClient = useQueryClient();
  return () => void queryClient.invalidateQueries({ queryKey: OPERATORS_KEY });
}

export function useCreateOperator() {
  const invalidar = useInvalidarOperators();

  return useMutation({
    mutationFn: (input: CreateOperatorInput) => OperatorAPI.create(input),
    onSuccess: (operator) => {
      invalidar();
      toast.success('Operador creado', { description: operator.name });
    },
    onError: (error: unknown) => {
      toast.danger(error instanceof Error ? error.message : 'No se pudo crear el operador.');
    },
  });
}

export function useUpdateOperator() {
  const invalidar = useInvalidarOperators();

  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateOperatorInput }) => OperatorAPI.update(id, input),
    onSuccess: (operator) => {
      invalidar();
      toast.success('Operador actualizado', { description: operator.name });
    },
    onError: (error: unknown) => {
      toast.danger(error instanceof Error ? error.message : 'No se pudo actualizar el operador.');
    },
  });
}

/** Toggle rápido activar/desactivar (sin abrir el modal de edición) —
 * `PATCH { isActive }`. Comparte mensajes con `useUpdateOperator` porque
 * pega al mismo endpoint. */
export function useToggleOperatorActive() {
  const invalidar = useInvalidarOperators();

  return useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      OperatorAPI.update(id, { isActive }),
    onSuccess: (operator) => {
      invalidar();
      toast.success(operator.isActive ? 'Operador activado' : 'Operador desactivado', {
        description: operator.name,
      });
    },
    onError: (error: unknown) => {
      toast.danger(error instanceof Error ? error.message : 'No se pudo actualizar el operador.');
    },
  });
}

export function useDeleteOperator() {
  const invalidar = useInvalidarOperators();

  return useMutation({
    mutationFn: (id: string) => OperatorAPI.remove(id),
    onSuccess: () => {
      invalidar();
      toast.success('Operador eliminado');
    },
    onError: (error: unknown) => {
      // El backend rechaza con 409 si el operador está en uso y sugiere
      // desactivarlo — ese mensaje llega tal cual (ver `OperatorAPI.remove`).
      toast.danger(error instanceof Error ? error.message : 'No se pudo eliminar el operador.');
    },
  });
}
