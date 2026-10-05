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
import { combustibleEntity, equipmentDocumentEntity, equipmentEntity, horometroEntity } from '../db';
import {
  aceptarCualquiera,
  bodyText,
  defineEndpoint,
  etiqueta,
  param,
  parseWith,
  type DomainRegistry,
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

export const FLOTA_ENDPOINTS: DomainRegistry<FlotaEndpointMap> = {
  'equipment.create': defineEndpoint({
    method: 'POST',
    path: () => '/api/equipment',
    failMessage: 'No se pudo crear el equipo.',
    parse: parseWith(EquipmentSchema),
    invalidate: ['equipment'],
    label: (_params, body) => etiqueta('Nuevo equipo', bodyText(body, 'internalCode')),
    notFoundIsDone: false,
    carriesFiles: true,
    creates: true,
    entity: (_params, body) => {
      const id = bodyText(body, 'id');
      return id ? equipmentEntity(id) : undefined;
    },
  }),
  'equipment.update': defineEndpoint({
    method: 'PATCH',
    path: (params) => `/api/equipment/${param(params, 'id')}`,
    failMessage: 'No se pudo actualizar el equipo.',
    parse: parseWith(EquipmentSchema),
    invalidate: ['equipment'],
    label: (params) => etiqueta('Edición de equipo', cachedName('equipment', params.id ?? '')),
    notFoundIsDone: false,
    carriesFiles: true,
    entity: (params) => (params.id ? equipmentEntity(params.id) : undefined),
  }),
  'equipment.status': defineEndpoint({
    method: 'PATCH',
    path: (params) => `/api/equipment/${param(params, 'id')}/status`,
    failMessage: 'No se pudo actualizar el estado del equipo.',
    parse: parseWith(EquipmentSchema),
    invalidate: ['equipment'],
    label: (params) => etiqueta('Cambio de estado', cachedName('equipment', params.id ?? '')),
    notFoundIsDone: false,
    carriesFiles: false,
    entity: (params) => (params.id ? equipmentEntity(params.id) : undefined),
  }),
  'equipment.assign': defineEndpoint({
    method: 'PATCH',
    path: (params) => `/api/equipment/${param(params, 'id')}/assignment`,
    failMessage: 'No se pudo actualizar la asignación del equipo.',
    parse: parseWith(EquipmentSchema),
    invalidate: ['equipment'],
    label: (params) => etiqueta('Asignación de equipo', cachedName('equipment', params.id ?? '')),
    notFoundIsDone: false,
    carriesFiles: false,
    entity: (params) => (params.id ? equipmentEntity(params.id) : undefined),
  }),
  'equipment.delete': defineEndpoint({
    method: 'DELETE',
    path: (params) => `/api/equipment/${param(params, 'id')}`,
    failMessage: 'No se pudo eliminar el equipo.',
    parse: aceptarCualquiera,
    invalidate: ['equipment'],
    label: (params) => etiqueta('Eliminación de equipo', cachedName('equipment', params.id ?? '')),
    notFoundIsDone: true,
    carriesFiles: false,
    entity: (params) => (params.id ? equipmentEntity(params.id) : undefined),
  }),
  'equipmentDocument.create': defineEndpoint({
    method: 'POST',
    path: (params) => `/api/equipment/${param(params, 'equipmentId')}/documents`,
    failMessage: 'No se pudo crear el documento.',
    parse: parseWith(EquipmentDocumentSchema),
    invalidate: ['equipmentDocuments', 'equipment'],
    label: (params) => etiqueta('Nuevo documento', cachedName('equipment', params.equipmentId ?? '')),
    notFoundIsDone: false,
    carriesFiles: true,
    creates: true,
    entity: (_params, body) => {
      const id = bodyText(body, 'id');
      return id ? equipmentDocumentEntity(id) : undefined;
    },
    parents: (params) => (params.equipmentId ? [equipmentEntity(params.equipmentId)] : []),
  }),
  'equipmentDocument.update': defineEndpoint({
    method: 'PATCH',
    path: (params) => `/api/equipment/documents/${param(params, 'id')}`,
    failMessage: 'No se pudo actualizar el documento.',
    parse: parseWith(EquipmentDocumentSchema),
    invalidate: ['equipmentDocuments', 'equipment'],
    label: (params) => etiqueta('Edición de documento', cachedName('document', params.id ?? '')),
    notFoundIsDone: false,
    carriesFiles: true,
    entity: (params) => (params.id ? equipmentDocumentEntity(params.id) : undefined),
  }),
  'equipmentDocument.delete': defineEndpoint({
    method: 'DELETE',
    path: (params) => `/api/equipment/documents/${param(params, 'id')}`,
    failMessage: 'No se pudo eliminar el documento.',
    parse: aceptarCualquiera,
    invalidate: ['equipmentDocuments', 'equipment'],
    label: (params) => etiqueta('Eliminación de documento', cachedName('document', params.id ?? '')),
    notFoundIsDone: true,
    carriesFiles: false,
    entity: (params) => (params.id ? equipmentDocumentEntity(params.id) : undefined),
  }),
  'horometro.create': defineEndpoint({
    method: 'POST',
    path: () => '/api/horometro',
    failMessage: 'No se pudo registrar la entrada.',
    parse: aceptarCualquiera,
    invalidate: ['horometro', 'equipment'],
    label: (_params, body) => etiqueta('Entrada de turno', cachedName('equipment', bodyText(body, 'equipoId') ?? '')),
    notFoundIsDone: false,
    carriesFiles: false,
    creates: true,
    entity: (_params, body) => {
      const id = bodyText(body, 'id');
      return id ? horometroEntity(id) : undefined;
    },
    parents: (_params, body) => {
      const equipoId = bodyText(body, 'equipoId');
      return equipoId ? [equipmentEntity(equipoId)] : [];
    },
  }),
  'horometro.close': defineEndpoint({
    method: 'PATCH',
    path: (params) => `/api/horometro/${param(params, 'id')}/salida`,
    failMessage: 'No se pudo registrar la salida.',
    parse: aceptarCualquiera,
    invalidate: ['horometro', 'equipment'],
    label: () => 'Salida de turno',
    notFoundIsDone: false,
    carriesFiles: false,
    entity: (params) => (params.id ? horometroEntity(params.id) : undefined),
  }),
  'combustible.create': defineEndpoint({
    method: 'POST',
    path: () => '/api/combustible',
    failMessage: 'No se pudo registrar la carga de combustible.',
    parse: aceptarCualquiera,
    invalidate: ['combustible', 'equipment'],
    label: (_params, body) =>
      etiqueta('Carga de combustible', cachedName('equipment', bodyText(body, 'equipoId') ?? '')),
    notFoundIsDone: false,
    carriesFiles: true,
    creates: true,
    entity: (_params, body) => {
      const id = bodyText(body, 'id');
      return id ? combustibleEntity(id) : undefined;
    },
    parents: (_params, body) => {
      const equipoId = bodyText(body, 'equipoId');
      return equipoId ? [equipmentEntity(equipoId)] : [];
    },
  }),
};
