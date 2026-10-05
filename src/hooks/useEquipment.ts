import { useMutation, useQuery } from '@tanstack/react-query';
import { toast } from '@heroui/react';

import { EquipmentAPI, type EquipmentFiltros } from '../api/EquipmentAPI';
import { DomainError } from '../lib/api-error';
import { conPendientes, diferenciaEdicion, precondicion } from '../lib/edit-diff';
import { mensajeErrorFormulario } from '../lib/error-messages';
import { avisarGuardadoEnCola } from '../lib/outbox-feedback';
import { EQUIPMENT_KEY } from '../lib/query-keys';
import { generateUuid } from '../lib/uuid';
import { equipmentEntity } from '../offline/db';
import { cambiosPendientes } from '../offline/outbox';
import type { SubmitWriteResult } from '../offline/submit-write';
import type {
  AssignEquipmentInput,
  CreateEquipmentInput,
  Equipment,
  EquipmentStatus,
  UpdateEquipmentInput,
} from '../types/equipment';
import { useOfficeMutation, writeOffice } from './useOfficeMutation';

// La key vive en `lib/query-keys.ts` (la comparte `offline/replay.ts`, que no
// puede importar de `hooks/`); se re-exporta para los consumidores existentes.
export { EQUIPMENT_KEY };

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
 * Mensaje amigable para un error de `equipment.assign` — el operador es
 * ahora un id del catálogo propio (`OperatorsService.assertActive`), así que
 * guardar puede fallar con 409 `OPERATOR_INACTIVE` (mapeado en `lib/error-messages.ts`,
 * compartido con Tarjetas de turno y Trabajos extra) o 404 (dejó de existir
 * en el catálogo). El 404 no trae un `code` propio del backend — se
 * distingue por `status`, no por texto (que podría no ser ni claro ni estar
 * en español), así que ese caso queda como contexto propio de este caller.
 */
function mensajeErrorAsignacion(error: unknown): string {
  if (error instanceof DomainError && error.status === 404) {
    return 'El operador o supervisor elegido ya no existe. Actualizá la página e intentá de nuevo.';
  }
  return mensajeErrorFormulario(error, 'No se pudo actualizar la asignación.');
}

/** Las escrituras de un equipo que cambian sus campos: una edición nueva parte de
 * lo que ellas dejarán (ver `conPendientes`). */
const ESCRITURAS_DE_CAMPOS = ['equipment.update', 'equipment.status'] as const;

type CamposDeEquipo = Omit<UpdateEquipmentInput, 'photoKey'>;

const CAMPOS_DE_EQUIPO = [
  'licensePlate',
  'equipmentClass',
  'type',
  'brand',
  'model',
  'year',
  'controlUnit',
  'status',
  'homeBranchId',
] as const satisfies readonly (keyof CamposDeEquipo)[];

function camposDeEquipo(equipo: Equipment): CamposDeEquipo {
  return {
    licensePlate: equipo.licensePlate,
    equipmentClass: equipo.equipmentClass,
    type: equipo.type,
    brand: equipo.brand,
    model: equipo.model,
    year: equipo.year,
    controlUnit: equipo.controlUnit,
    status: equipo.status,
    homeBranchId: equipo.homeBranchId,
  };
}

export interface CreateEquipmentVars {
  input: CreateEquipmentInput;
  /** Foto del equipo: se guarda en el equipo y se sube al sincronizar. */
  photo?: File | null;
  /** Asignación inicial; se encola detrás de la creación. */
  asignacion?: AssignEquipmentInput;
}

export interface CreateEquipmentResult {
  creada: SubmitWriteResult<'equipment.create'>;
  asignada: SubmitWriteResult<'equipment.assign'> | null;
}

/**
 * Crear un equipo (y, si se pidió, asignarlo). El `id` lo genera el cliente: con
 * él la asignación se encadena a la creación aunque esta siga esperando señal.
 * Si la asignación falla por una razón de negocio, el equipo igual quedó creado:
 * se avisa aparte en vez de tumbar toda la mutación.
 */
export function useCreateEquipment() {
  return useMutation<CreateEquipmentResult, Error, CreateEquipmentVars>({
    mutationFn: async ({ input, photo, asignacion }) => {
      const id = generateUuid();
      const creada = await writeOffice('equipment.create', {
        params: {},
        body: { ...input, id },
        ...(photo ? { files: [{ field: 'photoKey', file: photo }] } : {}),
      });
      if (!asignacion || Object.keys(asignacion).length === 0) return { creada, asignada: null };
      try {
        const asignada = await writeOffice('equipment.assign', {
          params: { id },
          body: asignacion,
          // Un equipo recién creado no tiene a nadie asignado.
          expected: precondicion({ operatorId: null, supervisorId: null }, Object.keys(asignacion)),
          dependsOn: creada.status === 'queued' ? [creada.opId] : undefined,
        });
        return { creada, asignada };
      } catch (error: unknown) {
        toast.danger(mensajeErrorAsignacion(error));
        return { creada, asignada: null };
      }
    },
    onSuccess: ({ creada, asignada }, { input }) => {
      if (creada.status === 'sent') {
        toast.success('Equipo creado', {
          description: `${creada.data?.internalCode ?? input.internalCode} ya está en la flota.`,
        });
        if (asignada?.status === 'sent') toast.success('Asignación actualizada');
        else if (asignada?.status === 'queued') avisarGuardadoEnCola();
        return;
      }
      avisarGuardadoEnCola();
    },
    onError: (error: unknown) => {
      toast.danger(mensajeErrorFormulario(error, 'No se pudo crear el equipo.'));
    },
  });
}

export interface UpdateEquipmentVars {
  /** El equipo tal como lo muestra la pantalla: la base de la edición. */
  equipo: Equipment;
  input: Omit<UpdateEquipmentInput, 'photoKey'>;
  /** Foto nueva: se guarda en el equipo y se sube al sincronizar. */
  photo?: File | null;
  quitarFoto?: boolean;
}

export function useUpdateEquipment() {
  return useOfficeMutation<'equipment.update', UpdateEquipmentVars>({
    endpoint: 'equipment.update',
    build: async ({ equipo, input, photo, quitarFoto }) => {
      const pendiente = await cambiosPendientes(equipmentEntity(equipo.id), ESCRITURAS_DE_CAMPOS);
      const base = conPendientes(camposDeEquipo(equipo), pendiente, CAMPOS_DE_EQUIPO);
      const { cambios, esperado } = diferenciaEdicion(base, input, CAMPOS_DE_EQUIPO);
      if (Object.keys(cambios).length === 0 && !photo && !quitarFoto) return null;
      const precondiciones = precondicion(esperado);
      return {
        params: { id: equipo.id },
        body: { ...cambios, ...(quitarFoto ? { photoKey: null } : {}) },
        ...(Object.keys(precondiciones).length > 0 ? { expected: precondiciones } : {}),
        ...(photo ? { files: [{ field: 'photoKey', file: photo }] } : {}),
      };
    },
    onSent: (data, { equipo }) => {
      toast.success('Equipo actualizado', { description: data?.internalCode ?? equipo.internalCode });
    },
    errorFallback: 'No se pudo actualizar el equipo.',
  });
}

export interface UpdateEquipmentStatusVars {
  equipo: Pick<Equipment, 'id' | 'internalCode' | 'status'>;
  status: EquipmentStatus;
}

export function useUpdateEquipmentStatus() {
  return useOfficeMutation<'equipment.status', UpdateEquipmentStatusVars>({
    endpoint: 'equipment.status',
    build: async ({ equipo, status }) => {
      const pendiente = await cambiosPendientes(equipmentEntity(equipo.id), ESCRITURAS_DE_CAMPOS);
      const base = conPendientes({ status: equipo.status }, pendiente, ['status']);
      return {
        params: { id: equipo.id },
        body: { status },
        expected: precondicion({ status: base.status }),
      };
    },
    onSent: (data, { equipo }) => {
      toast.success('Estado actualizado', { description: data?.internalCode ?? equipo.internalCode });
    },
    errorFallback: 'No se pudo actualizar el estado.',
  });
}

export interface AssignEquipmentVars {
  equipo: Pick<Equipment, 'id' | 'internalCode' | 'operator' | 'supervisor'>;
  /** Solo lo que cambió (`buildAssignmentDiff`). */
  input: AssignEquipmentInput;
}

/**
 * Asigna/libera operador y supervisor (`PATCH /equipment/:id/assignment`).
 * Mutación aparte de `useUpdateEquipment` porque es un endpoint distinto en
 * el backend (gate de rol propio) y porque `EquipoActionsMenu`/`CamposEquipo`
 * la disparan de forma independiente al resto del formulario.
 */
export function useAssignEquipment() {
  return useOfficeMutation<'equipment.assign', AssignEquipmentVars>({
    endpoint: 'equipment.assign',
    build: async ({ equipo, input }) => {
      const pendiente = await cambiosPendientes(equipmentEntity(equipo.id), ['equipment.assign']);
      const base = conPendientes(
        { operatorId: equipo.operator?.id ?? null, supervisorId: equipo.supervisor?.id ?? null },
        pendiente,
        ['operatorId', 'supervisorId'],
      );
      return {
        params: { id: equipo.id },
        body: input,
        expected: precondicion(base, Object.keys(input)),
      };
    },
    onSent: (data, { equipo }) => {
      toast.success('Asignación actualizada', { description: data?.internalCode ?? equipo.internalCode });
    },
    errorFallback: 'No se pudo actualizar la asignación.',
    errorMessage: mensajeErrorAsignacion,
  });
}

export function useDeleteEquipment() {
  return useOfficeMutation<'equipment.delete', string>({
    endpoint: 'equipment.delete',
    build: (id) => ({ params: { id }, body: {} }),
    onSent: () => {
      toast.success('Equipo eliminado');
    },
    // El backend rechaza con 409 y un mensaje que explica por qué (tiene
    // historial) y qué hacer en su lugar (pasarlo a "Fuera de servicio").
    // Ese texto llega tal cual acá — no hay que reescribirlo.
    errorFallback: 'No se pudo eliminar el equipo.',
  });
}
