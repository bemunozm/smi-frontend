import { useQuery } from '@tanstack/react-query';
import { toast } from '@heroui/react';

import { BranchAPI, type BranchFiltros } from '../api/BranchAPI';
import { pickFields } from '../lib/edit-diff';
import { BRANCHES_KEY } from '../lib/query-keys';
import { buildQueuedEdit } from '../lib/queued-edit';
import { branchEntity } from '../offline/db';
import type { Branch, BranchFields, CreateBranchInput, UpdateBranchInput } from '../types/branch';
import { useQueuedCreate, useQueuedDelete, useQueuedMutation } from './useQueuedMutation';

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

export function useCreateBranch() {
  return useQueuedCreate<'branch.create', CreateBranchInput>({
    endpoint: 'branch.create',
    build: (input, id) => ({ params: {}, body: { ...input, id } }),
    onSent: (branch, input) => {
      toast.success('Sucursal creada', { description: branch?.name ?? input.name });
    },
    errorFallback: 'No se pudo crear la sucursal.',
  });
}

const CAMPOS_DE_SUCURSAL = ['name', 'address', 'isActive'] as const;

export interface UpdateBranchVars {
  /** La sucursal tal como la muestra la pantalla: la base de la edición. */
  branch: Branch;
  input: UpdateBranchInput;
}

export function useUpdateBranch() {
  return useQueuedMutation<'branch.update', UpdateBranchVars>({
    endpoint: 'branch.update',
    build: async ({ branch, input }) => {
      // Una dirección vacía no se manda (el formulario la omite): "omitida" es
      // "sin cambio".
      const edicion = await buildQueuedEdit<BranchFields>({
        entity: branchEntity(branch.id),
        ops: ['branch.update'],
        base: pickFields(branch, CAMPOS_DE_SUCURSAL),
        next: input,
        fields: CAMPOS_DE_SUCURSAL,
      });
      if (!edicion.hayCambios) return null;
      return { params: { id: branch.id }, body: edicion.cambios, expected: edicion.esperado };
    },
    onSent: (data, { branch }) => {
      toast.success('Sucursal actualizada', { description: data?.name ?? branch.name });
    },
    errorFallback: 'No se pudo actualizar la sucursal.',
  });
}

export function useDeleteBranch() {
  // El backend rechaza con 409 si la sucursal tiene equipos asociados y explica
  // cómo retirarla en su lugar (isActive=false): el mensaje llega tal cual.
  return useQueuedDelete({
    endpoint: 'branch.delete',
    sentMessage: 'Sucursal eliminada',
    errorFallback: 'No se pudo eliminar la sucursal.',
  });
}
