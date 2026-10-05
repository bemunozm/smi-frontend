import { useMutation, useQuery } from '@tanstack/react-query';
import { toast } from '@heroui/react';

import { EquipmentAPI, type EquipmentFiltros } from '../api/EquipmentAPI';
import { DomainError } from '../lib/api-error';
import { pickFields, precondicion } from '../lib/edit-diff';
import { mensajeErrorFormulario } from '../lib/error-messages';
import { avisarGuardadoEnCola } from '../lib/outbox-feedback';
import { EQUIPMENT_KEY } from '../lib/query-keys';
import { buildQueuedEdit, pendingBase } from '../lib/queued-edit';
import { generateUuid } from '../lib/uuid';
import { equipmentEntity } from '../offline/db';
import type { SubmitWriteResult } from '../offline/submit-write';
import type {
  AssignEquipmentInput,
  CreateEquipmentInput,
  Equipment,
  EquipmentStatus,
  UpdateEquipmentInput,
} from '../types/equipment';
import { useQueuedDelete, useQueuedMutation, writeQueued } from './useQueuedMutation';

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
      const creada = await writeQueued('equipment.create', {
        params: {},
        body: { ...input, id },
        ...(photo ? { files: [{ field: 'photoKey', file: photo }] } : {}),
      });
      if (!asignacion || Object.keys(asignacion).length === 0) return { creada, asignada: null };
      try {
        const asignada = await writeQueued('equipment.assign', {
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

/** Arma la edición de un equipo contra su base; `null` si no hay nada que mandar. */
async function edicionDeEquipo({ equipo, input, photo, quitarFoto }: UpdateEquipmentVars) {
  const edicion = await buildQueuedEdit<CamposDeEquipo>({
    entity: equipmentEntity(equipo.id),
    ops: ESCRITURAS_DE_CAMPOS,
    base: pickFields(equipo, CAMPOS_DE_EQUIPO),
    next: input,
    fields: CAMPOS_DE_EQUIPO,
  });
  if (!edicion.hayCambios && !photo && !quitarFoto) return null;
  return {
    params: { id: equipo.id },
    body: { ...edicion.cambios, ...(quitarFoto ? { photoKey: null } : {}) },
    expected: edicion.esperado,
    ...(photo ? { files: [{ field: 'photoKey', file: photo }] } : {}),
  };
}

export function useUpdateEquipment() {
  return useQueuedMutation<'equipment.update', UpdateEquipmentVars>({
    endpoint: 'equipment.update',
    build: edicionDeEquipo,
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
  return useQueuedMutation<'equipment.status', UpdateEquipmentStatusVars>({
    endpoint: 'equipment.status',
    build: async ({ equipo, status }) => {
      const base = await pendingBase({
        entity: equipmentEntity(equipo.id),
        ops: ESCRITURAS_DE_CAMPOS,
        base: { status: equipo.status },
        fields: ['status'],
      });
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
/** Arma la asignación contra la que el equipo tendrá cuando lo ya guardado llegue. */
async function asignacionDeEquipo({ equipo, input }: AssignEquipmentVars) {
  const base = await pendingBase({
    entity: equipmentEntity(equipo.id),
    ops: ['equipment.assign'],
    base: { operatorId: equipo.operator?.id ?? null, supervisorId: equipo.supervisor?.id ?? null },
    fields: ['operatorId', 'supervisorId'],
  });
  return {
    params: { id: equipo.id },
    body: input,
    expected: precondicion(base, Object.keys(input)),
  };
}

export function useAssignEquipment() {
  return useQueuedMutation<'equipment.assign', AssignEquipmentVars>({
    endpoint: 'equipment.assign',
    build: asignacionDeEquipo,
    onSent: (data, { equipo }) => {
      toast.success('Asignación actualizada', { description: data?.internalCode ?? equipo.internalCode });
    },
    errorFallback: 'No se pudo actualizar la asignación.',
    errorMessage: mensajeErrorAsignacion,
  });
}

export interface SaveEquipmentVars extends UpdateEquipmentVars {
  /** Lo que cambió de la asignación (`buildAssignmentDiff`); vacío si no cambió. */
  asignacion: AssignEquipmentInput;
}

interface SaveEquipmentResult {
  actualizada: SubmitWriteResult<'equipment.update'> | null;
  asignada: SubmitWriteResult<'equipment.assign'> | null;
  /** La asignación falló (p. ej. el operador ya no está activo); la ficha ya quedó guardada. */
  errorAsignacion: unknown;
}

/**
 * Guarda la ficha de un equipo y, si cambió, su asignación. Son dos endpoints
 * (gate de rol propio cada uno): la asignación solo se intenta si la ficha se
 * guardó, y si falla la ficha queda guardada y el aviso lo dice; quien llama no
 * debe cerrar el formulario mientras `errorAsignacion` esté, para que se vea el
 * error y se pueda reintentar.
 */
export function useSaveEquipment() {
  return useMutation<SaveEquipmentResult, Error, SaveEquipmentVars>({
    mutationFn: async ({ asignacion, ...vars }) => {
      const edicion = await edicionDeEquipo(vars);
      const actualizada = edicion ? await writeQueued('equipment.update', edicion) : null;
      if (Object.keys(asignacion).length === 0) return { actualizada, asignada: null, errorAsignacion: null };
      try {
        const cambio = await asignacionDeEquipo({ equipo: vars.equipo, input: asignacion });
        return { actualizada, asignada: await writeQueued('equipment.assign', cambio), errorAsignacion: null };
      } catch (error: unknown) {
        return { actualizada, asignada: null, errorAsignacion: error };
      }
    },
    onSuccess: ({ actualizada, asignada, errorAsignacion }, { equipo }) => {
      if (actualizada?.status === 'sent') {
        toast.success('Equipo actualizado', { description: actualizada.data?.internalCode ?? equipo.internalCode });
      }
      if (asignada?.status === 'sent') {
        toast.success('Asignación actualizada', { description: asignada.data?.internalCode ?? equipo.internalCode });
      }
      if (actualizada?.status === 'queued' || asignada?.status === 'queued') avisarGuardadoEnCola();
      if (errorAsignacion !== null) toast.danger(mensajeErrorAsignacion(errorAsignacion));
    },
    onError: (error) => {
      toast.danger(mensajeErrorFormulario(error, 'No se pudo actualizar el equipo.'));
    },
  });
}

export function useDeleteEquipment() {
  // El backend rechaza con 409 y un mensaje que explica por qué (tiene
  // historial) y qué hacer en su lugar (pasarlo a "Fuera de servicio").
  return useQueuedDelete({
    endpoint: 'equipment.delete',
    sentMessage: 'Equipo eliminado',
    errorFallback: 'No se pudo eliminar el equipo.',
  });
}
