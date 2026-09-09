import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from '@heroui/react';

import { BranchAPI, type BranchFiltros } from '../api/BranchAPI';
import type { CreateBranchInput, UpdateBranchInput } from '../types/branch';

const BRANCHES_KEY = ['branches'] as const;

/**
 * Lista de sucursales (Plataforma). La usa el selector `homeBranch` del
 * formulario de Flota — mismo patrón retrocompatible que `useEquipment`: sin
 * filtros usa `['branches']`, con filtros agrega el objeto aparte.
 */
export function useBranches(filtros: BranchFiltros = {}) {
  const tieneFiltros = Object.keys(filtros).length > 0;
  return useQuery({
    queryKey: tieneFiltros ? [...BRANCHES_KEY, filtros] : BRANCHES_KEY,
    queryFn: () => BranchAPI.list(filtros),
  });
}

export function useBranch(id: string) {
  return useQuery({
    queryKey: [...BRANCHES_KEY, id],
    queryFn: () => BranchAPI.getById(id),
    enabled: !!id,
  });
}

function useInvalidarBranches() {
  const queryClient = useQueryClient();
  return () => void queryClient.invalidateQueries({ queryKey: BRANCHES_KEY });
}

export function useCreateBranch() {
  const invalidar = useInvalidarBranches();

  return useMutation({
    mutationFn: (input: CreateBranchInput) => BranchAPI.create(input),
    onSuccess: (branch) => {
      invalidar();
      toast.success('Sucursal creada', { description: branch.name });
    },
    onError: (error: unknown) => {
      toast.danger(error instanceof Error ? error.message : 'No se pudo crear la sucursal.');
    },
  });
}

export function useUpdateBranch() {
  const invalidar = useInvalidarBranches();

  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateBranchInput }) =>
      BranchAPI.update(id, input),
    onSuccess: (branch) => {
      invalidar();
      toast.success('Sucursal actualizada', { description: branch.name });
    },
    onError: (error: unknown) => {
      toast.danger(error instanceof Error ? error.message : 'No se pudo actualizar la sucursal.');
    },
  });
}

export function useDeleteBranch() {
  const invalidar = useInvalidarBranches();

  return useMutation({
    mutationFn: (id: string) => BranchAPI.remove(id),
    onSuccess: () => {
      invalidar();
      toast.success('Sucursal eliminada');
    },
    onError: (error: unknown) => {
      // El backend rechaza con 409 si la sucursal tiene equipos asociados y
      // explica cómo retirarla en su lugar (isActive=false) — mismo criterio
      // que `useDeleteEquipment`, el mensaje llega tal cual.
      toast.danger(error instanceof Error ? error.message : 'No se pudo eliminar la sucursal.');
    },
  });
}
