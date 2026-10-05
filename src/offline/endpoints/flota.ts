import type { CombustibleForm } from '../../types/combustible';
import {
  EquipmentSchema,
  type AssignEquipmentInput,
  type CreateEquipmentInput,
  type Equipment,
  type EquipmentStatus,
  type UpdateEquipmentInput,
} from '../../types/equipment';
import {
  EquipmentDocumentSchema,
  type CreateEquipmentDocumentInput,
  type EquipmentDocument,
  type UpdateEquipmentDocumentInput,
} from '../../types/equipment-document';
import type { CerrarHorometroInput, HorometroForm } from '../../types/horometro';
import { cachedName } from '../cache-upserts';
import {
  branchEntity,
  combustibleEntity,
  equipmentDocumentEntity,
  equipmentEntity,
  horometroEntity,
  operatorEntity,
} from '../db';
import {
  aceptarCualquiera,
  bodyText,
  defineDomain,
  entityOf,
  etiqueta,
  param,
  parseWith,
  referencias,
  type NoParams,
  type WithId,
} from './define';

/** El archivo (`photoKey`, `fileKey`, `fotoKey`) NO está en estos bodies: viaja
 * como `files` y el replay lo escribe con la key que devuelve la subida. */
export interface FlotaEndpointMap {
  'equipment.create': { params: NoParams; body: WithId<Omit<CreateEquipmentInput, 'photoKey'>>; result: Equipment };
  /** `photoKey: null` (quitar la foto) sí viaja en el body; una foto nueva, como archivo. */
  'equipment.update': { params: { id: string }; body: Partial<UpdateEquipmentInput>; result: Equipment };
  'equipment.status': { params: { id: string }; body: { status: EquipmentStatus }; result: Equipment };
  'equipment.assign': { params: { id: string }; body: AssignEquipmentInput; result: Equipment };
  'equipment.delete': { params: { id: string }; body: NoParams; result: true };
  'equipmentDocument.create': {
    params: { equipmentId: string };
    body: WithId<Omit<CreateEquipmentDocumentInput, 'fileKey'>>;
    result: EquipmentDocument;
  };
  'equipmentDocument.update': { params: { id: string }; body: UpdateEquipmentDocumentInput; result: EquipmentDocument };
  'equipmentDocument.delete': { params: { id: string }; body: NoParams; result: true };
  'horometro.create': {
    params: NoParams;
    body: WithId<Omit<HorometroForm, 'fotoUrl'>> & { capturedAt: string };
    result: true;
  };
  'horometro.close': {
    params: { id: string };
    body: Omit<CerrarHorometroInput, 'fotoUrlSalida'> & { closeClientId: string; capturedAt: string };
    result: true;
  };
  'combustible.create': {
    params: NoParams;
    body: WithId<Omit<CombustibleForm, 'fotoUrl' | 'fotoKey'>>;
    result: true;
  };
}

export const FLOTA_ENDPOINTS = defineDomain<FlotaEndpointMap>({
  'equipment.create': {
    method: 'POST',
    path: () => '/api/equipment',
    failMessage: 'No se pudo crear el equipo.',
    parse: parseWith(EquipmentSchema),
    invalidate: ['equipment'],
    label: (_params, body) => etiqueta('Nuevo equipo', bodyText(body, 'internalCode')),
    notFoundIsDone: false,
    carriesFiles: true,
    creates: true,
    entity: (_params, body) => entityOf(equipmentEntity, bodyText(body, 'id')),
    parents: (_params, body) => referencias(entityOf(branchEntity, bodyText(body, 'homeBranchId'))),
  },
  'equipment.update': {
    method: 'PATCH',
    path: (params) => `/api/equipment/${param(params, 'id')}`,
    failMessage: 'No se pudo actualizar el equipo.',
    parse: parseWith(EquipmentSchema),
    invalidate: ['equipment'],
    label: (params) => etiqueta('Edición de equipo', cachedName('equipment', params.id)),
    notFoundIsDone: false,
    carriesFiles: true,
    entity: (params) => entityOf(equipmentEntity, params.id),
    parents: (_params, body) => referencias(entityOf(branchEntity, bodyText(body, 'homeBranchId'))),
  },
  'equipment.status': {
    method: 'PATCH',
    path: (params) => `/api/equipment/${param(params, 'id')}/status`,
    failMessage: 'No se pudo actualizar el estado del equipo.',
    parse: parseWith(EquipmentSchema),
    invalidate: ['equipment'],
    label: (params) => etiqueta('Cambio de estado', cachedName('equipment', params.id)),
    notFoundIsDone: false,
    carriesFiles: false,
    entity: (params) => entityOf(equipmentEntity, params.id),
  },
  'equipment.assign': {
    method: 'PATCH',
    path: (params) => `/api/equipment/${param(params, 'id')}/assignment`,
    failMessage: 'No se pudo actualizar la asignación del equipo.',
    parse: parseWith(EquipmentSchema),
    invalidate: ['equipment'],
    label: (params) => etiqueta('Asignación de equipo', cachedName('equipment', params.id)),
    notFoundIsDone: false,
    carriesFiles: false,
    entity: (params) => entityOf(equipmentEntity, params.id),
    parents: (_params, body) => referencias(entityOf(operatorEntity, bodyText(body, 'operatorId'))),
  },
  'equipment.delete': {
    method: 'DELETE',
    path: (params) => `/api/equipment/${param(params, 'id')}`,
    failMessage: 'No se pudo eliminar el equipo.',
    parse: aceptarCualquiera,
    invalidate: ['equipment'],
    label: (params) => etiqueta('Eliminación de equipo', cachedName('equipment', params.id)),
    notFoundIsDone: true,
    carriesFiles: false,
    entity: (params) => entityOf(equipmentEntity, params.id),
  },
  'equipmentDocument.create': {
    method: 'POST',
    path: (params) => `/api/equipment/${param(params, 'equipmentId')}/documents`,
    failMessage: 'No se pudo crear el documento.',
    parse: parseWith(EquipmentDocumentSchema),
    invalidate: ['equipmentDocuments', 'equipment'],
    label: (params) => etiqueta('Nuevo documento', cachedName('equipment', params.equipmentId)),
    notFoundIsDone: false,
    carriesFiles: true,
    creates: true,
    entity: (_params, body) => entityOf(equipmentDocumentEntity, bodyText(body, 'id')),
    parents: (params) => referencias(entityOf(equipmentEntity, params.equipmentId)),
  },
  'equipmentDocument.update': {
    method: 'PATCH',
    path: (params) => `/api/equipment/documents/${param(params, 'id')}`,
    failMessage: 'No se pudo actualizar el documento.',
    parse: parseWith(EquipmentDocumentSchema),
    invalidate: ['equipmentDocuments', 'equipment'],
    label: (params) => etiqueta('Edición de documento', cachedName('document', params.id)),
    notFoundIsDone: false,
    carriesFiles: true,
    entity: (params) => entityOf(equipmentDocumentEntity, params.id),
  },
  'equipmentDocument.delete': {
    method: 'DELETE',
    path: (params) => `/api/equipment/documents/${param(params, 'id')}`,
    failMessage: 'No se pudo eliminar el documento.',
    parse: aceptarCualquiera,
    invalidate: ['equipmentDocuments', 'equipment'],
    label: (params) => etiqueta('Eliminación de documento', cachedName('document', params.id)),
    notFoundIsDone: true,
    carriesFiles: false,
    entity: (params) => entityOf(equipmentDocumentEntity, params.id),
  },
  'horometro.create': {
    method: 'POST',
    path: () => '/api/horometro',
    failMessage: 'No se pudo registrar la entrada.',
    parse: aceptarCualquiera,
    invalidate: ['horometro', 'equipment'],
    label: (_params, body) => etiqueta('Entrada de turno', cachedName('equipment', body.equipoId)),
    notFoundIsDone: false,
    carriesFiles: false,
    creates: true,
    entity: (_params, body) => entityOf(horometroEntity, bodyText(body, 'id')),
    parents: (_params, body) =>
      referencias(
        entityOf(equipmentEntity, bodyText(body, 'equipoId')),
        entityOf(operatorEntity, bodyText(body, 'operatorId')),
      ),
  },
  'horometro.close': {
    method: 'PATCH',
    path: (params) => `/api/horometro/${param(params, 'id')}/salida`,
    failMessage: 'No se pudo registrar la salida.',
    parse: aceptarCualquiera,
    invalidate: ['horometro', 'equipment'],
    label: () => 'Salida de turno',
    notFoundIsDone: false,
    carriesFiles: false,
    entity: (params) => entityOf(horometroEntity, params.id),
  },
  'combustible.create': {
    method: 'POST',
    path: () => '/api/combustible',
    failMessage: 'No se pudo registrar la carga de combustible.',
    parse: aceptarCualquiera,
    invalidate: ['combustible', 'equipment'],
    label: (_params, body) => etiqueta('Carga de combustible', cachedName('equipment', body.equipoId)),
    notFoundIsDone: false,
    carriesFiles: true,
    creates: true,
    entity: (_params, body) => entityOf(combustibleEntity, bodyText(body, 'id')),
    parents: (_params, body) => referencias(entityOf(equipmentEntity, bodyText(body, 'equipoId'))),
  },
});
