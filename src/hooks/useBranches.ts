import { useQuery } from '@tanstack/react-query';
import { toast } from '@heroui/react';

import { BranchAPI, type BranchFiltros } from '../api/BranchAPI';
import { conPendientes, diferenciaEdicion, precondicion } from '../lib/edit-diff';
import { BRANCHES_KEY } from '../lib/query-keys';
import { generateUuid } from '../lib/uuid';
import { branchEntity } from '../offline/db';
import { cambiosPendientes } from '../offline/outbox';
import type { Branch, BranchFields, CreateBranchInput, UpdateBranchInput } from '../types/branch';
import { useOfficeMutation } from './useOfficeMutation';

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
  return useOfficeMutation<'branch.create', CreateBranchInput>({
    endpoint: 'branch.create',
    build: (input) => ({ params: {}, body: { ...input, id: generateUuid() } }),
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
  return useOfficeMutation<'branch.update', UpdateBranchVars>({
    endpoint: 'branch.update',
    build: async ({ branch, input }) => {
      const pendiente = await cambiosPendientes(branchEntity(branch.id), ['branch.update']);
      const base = conPendientes<BranchFields>(
        { name: branch.name, address: branch.address, isActive: branch.isActive },
        pendiente,
        CAMPOS_DE_SUCURSAL,
      );
      // Una dirección vacía no se manda (el formulario la omite): "omitida" es
      // "sin cambio".
      const nuevo: BranchFields = {
        name: input.name ?? base.name,
        address: input.address ?? base.address,
        isActive: input.isActive ?? base.isActive,
      };
      const { cambios, esperado } = diferenciaEdicion(base, nuevo, CAMPOS_DE_SUCURSAL);
      if (Object.keys(cambios).length === 0) return null;
      return { params: { id: branch.id }, body: cambios, expected: precondicion(esperado) };
    },
    onSent: (data, { branch }) => {
      toast.success('Sucursal actualizada', { description: data?.name ?? branch.name });
    },
    errorFallback: 'No se pudo actualizar la sucursal.',
  });
}

export function useDeleteBranch() {
  return useOfficeMutation<'branch.delete', string>({
    endpoint: 'branch.delete',
    build: (id) => ({ params: { id }, body: {} }),
    onSent: () => {
      toast.success('Sucursal eliminada');
    },
    // El backend rechaza con 409 si la sucursal tiene equipos asociados y
    // explica cómo retirarla en su lugar (isActive=false) — mismo criterio
    // que `useDeleteEquipment`, el mensaje llega tal cual.
    errorFallback: 'No se pudo eliminar la sucursal.',
  });
}
