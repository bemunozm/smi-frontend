import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from '@heroui/react';

import { EquipmentAPI, type EquipmentFiltros } from '../api/EquipmentAPI';
import { DomainError } from '../lib/api-error';
import type {
  AssignEquipmentInput,
  CreateEquipmentInput,
  EquipmentStatus,
  UpdateEquipmentInput,
} from '../types/equipment';

// Exportada: `components/terreno/SyncStatus.tsx` la usa para refetchear el
// catálogo al "Preparar para uso sin señal" (RFC "Supervisión en Terreno"
// §Diseño → Offline), sin repetir el literal `['equipment']` a mano.
export const EQUIPMENT_KEY = ['equipment'] as const;

/**
 * Lista de equipos (Flota). Fuente única del dominio — la usan tanto las
 * pantallas de Flota como los formularios de Terreno e Inventario (que la
 * llaman SIN filtros para poblar sus selects de equipo).
 *
 * La query key es retrocompatible a propósito: SIN filtros usa `['equipment']`
 * (la misma que ya consumían los tests y los selects de Terreno/Inventario
 * antes de la migración a `Equipment`); CON filtros agrega el objeto para
 * cachear cada combinación aparte. Así esos hooks siguen funcionando sin
 * cambiar de forma, y las mutaciones de abajo (que invalidan el prefijo
 * `['equipment']`) refrescan todo a la vez.
 */
export function useEquipment(filtros: EquipmentFiltros = {}) {
  const tieneFiltros = Object.keys(filtros).length > 0;
  return useQuery({
    queryKey: tieneFiltros ? [...EQUIPMENT_KEY, filtros] : EQUIPMENT_KEY,
    queryFn: () => EquipmentAPI.list(filtros),
  });
}

export function useResumenFleet() {
  return useQuery({
    queryKey: [...EQUIPMENT_KEY, 'resumen'],
    queryFn: EquipmentAPI.resumen,
  });
}

export function useEquipmentDetail(id: string) {
  return useQuery({
    queryKey: [...EQUIPMENT_KEY, id],
    queryFn: () => EquipmentAPI.getById(id),
    enabled: !!id,
  });
}

/**
 * Invalida TODO el árbol `['equipment', ...]`: la lista (con o sin filtro),
 * el resumen y las fichas abiertas. Un cambio de estado mueve los tres a la
 * vez (el equipo sale de un filtro, entra en otro y cambia el conteo del
 * resumen).
 */
function useInvalidarEquipment() {
  const queryClient = useQueryClient();
  return () => void queryClient.invalidateQueries({ queryKey: EQUIPMENT_KEY });
}

export function useCreateEquipment() {
  const invalidar = useInvalidarEquipment();

  return useMutation({
    mutationFn: (input: CreateEquipmentInput) => EquipmentAPI.create(input),
    onSuccess: (equipment) => {
      invalidar();
      toast.success('Equipo creado', { description: `${equipment.internalCode} ya está en la flota.` });
    },
    onError: (error: unknown) => {
      toast.danger(error instanceof Error ? error.message : 'No se pudo crear el equipo.');
    },
  });
}

export function useUpdateEquipment() {
  const invalidar = useInvalidarEquipment();

  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateEquipmentInput }) =>
      EquipmentAPI.update(id, input),
    onSuccess: (equipment) => {
      invalidar();
      toast.success('Equipo actualizado', { description: equipment.internalCode });
    },
    onError: (error: unknown) => {
      toast.danger(error instanceof Error ? error.message : 'No se pudo actualizar el equipo.');
    },
  });
}

export function useUpdateEquipmentStatus() {
  const invalidar = useInvalidarEquipment();

  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: EquipmentStatus }) =>
      EquipmentAPI.updateStatus(id, status),
    onSuccess: (equipment) => {
      invalidar();
      toast.success('Estado actualizado', { description: equipment.internalCode });
    },
    onError: (error: unknown) => {
      toast.danger(error instanceof Error ? error.message : 'No se pudo actualizar el estado.');
    },
  });
}

/**
 * Mensaje amigable para un error de `EquipmentAPI.assign` — el operador es
 * ahora un id del catálogo propio (`OperatorsService.assertActive`, ver
 * anexo "el operador deja de ser usuario de la plataforma"), así que guardar
 * puede fallar con 409 `OPERATOR_INACTIVE` (el operador elegido se desactivó
 * entre que se abrió el form y se guardó) o 404 (dejó de existir en el
 * catálogo). Mismo texto que ya usa `useShiftCards.ts#CODE_MESSAGES` para el
 * mismo código, para no mostrar dos redacciones distintas del mismo caso en
 * la app. El 404 no trae un `code` propio del backend — se distingue por
 * `status`, no por texto (que podría no ser ni claro ni estar en español).
 */
function mensajeErrorAsignacion(error: unknown): string {
  if (error instanceof DomainError) {
    if (error.code === 'OPERATOR_INACTIVE') {
      return 'Ese operador ya no está activo. Elegí otro del catálogo.';
    }
    if (error.status === 404) {
      return 'El operador o supervisor elegido ya no existe. Actualizá la página e intentá de nuevo.';
    }
  }
  return error instanceof Error ? error.message : 'No se pudo actualizar la asignación.';
}

/**
 * Asigna/libera operador y supervisor (`PATCH /equipment/:id/assignment`).
 * Mutación aparte de `useUpdateEquipment` porque es un endpoint distinto en
 * el backend (gate de rol propio) y porque `EquipoActionsMenu`/`CamposEquipo`
 * la disparan de forma independiente al resto del formulario.
 */
export function useAssignEquipment() {
  const invalidar = useInvalidarEquipment();

  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: AssignEquipmentInput }) =>
      EquipmentAPI.assign(id, input),
    onSuccess: (equipment) => {
      invalidar();
      toast.success('Asignación actualizada', { description: equipment.internalCode });
    },
    onError: (error: unknown) => {
      toast.danger(mensajeErrorAsignacion(error));
    },
  });
}

export function useDeleteEquipment() {
  const invalidar = useInvalidarEquipment();

  return useMutation({
    mutationFn: (id: string) => EquipmentAPI.remove(id),
    onSuccess: () => {
      invalidar();
      toast.success('Equipo eliminado');
    },
    onError: (error: unknown) => {
      // El backend rechaza con 409 y un mensaje que explica por qué (tiene
      // historial) y qué hacer en su lugar (pasarlo a "Fuera de servicio").
      // Ese texto llega tal cual acá — no hay que reescribirlo.
      toast.danger(error instanceof Error ? error.message : 'No se pudo eliminar el equipo.');
    },
  });
}
