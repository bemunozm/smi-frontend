import { useQuery } from '@tanstack/react-query';
import { toast } from '@heroui/react';

import { OperatorAPI, type OperatorFiltros } from '../api/OperatorAPI';
import { conPendientes, diferenciaEdicion, precondicion } from '../lib/edit-diff';
import { OPERATORS_KEY } from '../lib/query-keys';
import { generateUuid } from '../lib/uuid';
import { operatorEntity } from '../offline/db';
import { cambiosPendientes } from '../offline/outbox';
import type { CreateOperatorInput, Operator, OperatorFields, UpdateOperatorInput } from '../types/operator';
import { useOfficeMutation } from './useOfficeMutation';

// La key vive en `lib/query-keys.ts` (la comparten `offline/` y la precarga de
// "Preparar para uso sin señal"); se re-exporta para los consumidores existentes.
export { OPERATORS_KEY };

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

export function useCreateOperator() {
  return useOfficeMutation<'operator.create', CreateOperatorInput>({
    endpoint: 'operator.create',
    build: (input) => ({ params: {}, body: { ...input, id: generateUuid() } }),
    onSent: (operator, input) => {
      toast.success('Operador creado', { description: operator?.name ?? input.name });
    },
    errorFallback: 'No se pudo crear el operador.',
  });
}

const CAMPOS_DE_OPERADOR = ['name', 'rut', 'isActive'] as const;

export interface UpdateOperatorVars {
  /** El operador tal como lo muestra la pantalla: la base de la edición. */
  operator: Operator;
  input: UpdateOperatorInput;
}

/** Arma la edición de un operador contra su base (lo que se ve más lo ya guardado
 * sin enviar). Un RUT omitido es "sin cambio": el contrato no admite borrarlo. */
async function edicionDeOperador({ operator, input }: UpdateOperatorVars) {
  const pendiente = await cambiosPendientes(operatorEntity(operator.id), ['operator.update']);
  const base = conPendientes<OperatorFields>(
    { name: operator.name, rut: operator.rut, isActive: operator.isActive },
    pendiente,
    CAMPOS_DE_OPERADOR,
  );
  const nuevo: OperatorFields = {
    name: input.name ?? base.name,
    rut: input.rut ?? base.rut,
    isActive: input.isActive ?? base.isActive,
  };
  const { cambios, esperado } = diferenciaEdicion(base, nuevo, CAMPOS_DE_OPERADOR);
  if (Object.keys(cambios).length === 0) return null;
  return { params: { id: operator.id }, body: cambios, expected: precondicion(esperado) };
}

export function useUpdateOperator() {
  return useOfficeMutation<'operator.update', UpdateOperatorVars>({
    endpoint: 'operator.update',
    build: edicionDeOperador,
    onSent: (data, { operator }) => {
      toast.success('Operador actualizado', { description: data?.name ?? operator.name });
    },
    errorFallback: 'No se pudo actualizar el operador.',
  });
}

/** Toggle rápido activar/desactivar (sin abrir el modal de edición) —
 * `PATCH { isActive }`. Comparte la escritura con `useUpdateOperator` porque
 * pega al mismo endpoint. */
export function useToggleOperatorActive() {
  return useOfficeMutation<'operator.update', { operator: Operator; isActive: boolean }>({
    endpoint: 'operator.update',
    build: ({ operator, isActive }) => edicionDeOperador({ operator, input: { isActive } }),
    onSent: (data, { operator, isActive }) => {
      toast.success(isActive ? 'Operador activado' : 'Operador desactivado', {
        description: data?.name ?? operator.name,
      });
    },
    errorFallback: 'No se pudo actualizar el operador.',
  });
}

export function useDeleteOperator() {
  return useOfficeMutation<'operator.delete', string>({
    endpoint: 'operator.delete',
    build: (id) => ({ params: { id }, body: {} }),
    onSent: () => {
      toast.success('Operador eliminado');
    },
    // El backend rechaza con 409 si el operador está en uso y sugiere
    // desactivarlo — ese mensaje llega tal cual.
    errorFallback: 'No se pudo eliminar el operador.',
  });
}
