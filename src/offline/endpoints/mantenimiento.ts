import {
  ActividadSchema,
  IntervencionSchema,
  OrdenTrabajoSchema,
  TareaSchema,
  UmbralSchema,
  type Actividad,
  type CreateActividadInput,
  type CreateIntervencionInput,
  type CreateOrdenInput,
  type CreateUmbralInput,
  type Intervencion,
  type OrdenFields,
  type OrdenTrabajo,
  type Tarea,
  type Umbral,
  type UpdateActividadInput,
} from '../../types/mantenimiento';
import {
  MaintenancePlanViewSchema,
  type MaintenancePlanView,
  type SaveMaintenancePlanInput,
} from '../../types/maintenance-plan';
import { cachedName } from '../cache-upserts';
import {
  actividadEntity,
  equipmentEntity,
  hallazgoEntity,
  intervencionEntity,
  ordenEntity,
  umbralEntity,
} from '../db';
import {
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

export interface MantenimientoEndpointMap {
  'orden.create': { params: NoParams; body: WithId<CreateOrdenInput>; result: OrdenTrabajo };
  'orden.update': { params: { id: string }; body: Partial<OrdenFields>; result: OrdenTrabajo };
  /** Marcar/desmarcar una tarea (`PATCH`, last-write-wins: sin precondición). */
  'orden.toggleTarea': {
    params: { ordenId: string; tareaId: string };
    body: { hecha: boolean };
    result: Tarea;
  };
  'intervencion.create': {
    params: { ordenId: string };
    body: WithId<CreateIntervencionInput>;
    result: Intervencion;
  };
  'actividad.create': { params: NoParams; body: WithId<CreateActividadInput>; result: Actividad };
  'actividad.update': { params: { id: string }; body: Partial<UpdateActividadInput>; result: Actividad };
  'umbral.create': { params: NoParams; body: WithId<CreateUmbralInput>; result: Umbral };
  /** Pauta de mantención de un equipo: se guarda entera (`PUT`, last-write-wins). */
  'maintenancePlan.save': {
    params: { equipmentId: string };
    body: SaveMaintenancePlanInput;
    result: MaintenancePlanView;
  };
}

export const MANTENIMIENTO_ENDPOINTS = defineDomain<MantenimientoEndpointMap>({
  'orden.create': {
    method: 'POST',
    path: () => '/api/mantenimiento/ordenes',
    failMessage: 'No se pudo crear la orden de trabajo.',
    parse: parseWith(OrdenTrabajoSchema),
    invalidate: ['ordenes'],
    label: (_params, body) => etiqueta('Nueva orden de trabajo', bodyText(body, 'titulo')),
    notFoundIsDone: false,
    carriesFiles: false,
    creates: true,
    entity: (_params, body) => entityOf(ordenEntity, bodyText(body, 'id')),
    parents: (_params, body) => referencias(entityOf(equipmentEntity, bodyText(body, 'equipoId'))),
  },
  'orden.update': {
    method: 'PATCH',
    path: (params) => `/api/mantenimiento/ordenes/${param(params, 'id')}`,
    failMessage: 'No se pudo actualizar la orden de trabajo.',
    parse: parseWith(OrdenTrabajoSchema),
    invalidate: ['ordenes'],
    label: (params) => etiqueta('Edición de orden de trabajo', cachedName('orden', params.id)),
    notFoundIsDone: false,
    carriesFiles: false,
    entity: (params) => entityOf(ordenEntity, params.id),
  },
  'orden.toggleTarea': {
    method: 'PATCH',
    path: (params) =>
      `/api/mantenimiento/ordenes/${param(params, 'ordenId')}/tareas/${param(params, 'tareaId')}`,
    failMessage: 'No se pudo actualizar la tarea.',
    parse: parseWith(TareaSchema),
    invalidate: ['ordenes'],
    label: (params) => etiqueta('Tarea de orden de trabajo', cachedName('orden', params.ordenId)),
    notFoundIsDone: false,
    carriesFiles: false,
    entity: (params) => entityOf(ordenEntity, params.ordenId),
  },
  'intervencion.create': {
    method: 'POST',
    path: (params) => `/api/mantenimiento/ordenes/${param(params, 'ordenId')}/intervenciones`,
    failMessage: 'No se pudo registrar la intervención.',
    parse: parseWith(IntervencionSchema),
    invalidate: ['intervenciones', 'ordenes'],
    label: (params) => etiqueta('Intervención', cachedName('orden', params.ordenId)),
    notFoundIsDone: false,
    carriesFiles: false,
    creates: true,
    entity: (_params, body) => entityOf(intervencionEntity, bodyText(body, 'id')),
    parents: (params) => referencias(entityOf(ordenEntity, params.ordenId)),
  },
  'actividad.create': {
    method: 'POST',
    path: () => '/api/mantenimiento/actividades',
    failMessage: 'No se pudo crear la actividad.',
    parse: parseWith(ActividadSchema),
    invalidate: ['actividades'],
    label: (_params, body) => etiqueta('Nueva actividad', bodyText(body, 'descripcion')),
    notFoundIsDone: false,
    carriesFiles: false,
    creates: true,
    entity: (_params, body) => entityOf(actividadEntity, bodyText(body, 'id')),
    parents: (_params, body) =>
      referencias(
        entityOf(equipmentEntity, bodyText(body, 'equipoId')),
        entityOf(hallazgoEntity, bodyText(body, 'hallazgoId')),
      ),
  },
  'actividad.update': {
    method: 'PATCH',
    path: (params) => `/api/mantenimiento/actividades/${param(params, 'id')}`,
    failMessage: 'No se pudo actualizar la actividad.',
    parse: parseWith(ActividadSchema),
    invalidate: ['actividades'],
    label: (params) => etiqueta('Edición de actividad', cachedName('actividad', params.id)),
    notFoundIsDone: false,
    carriesFiles: false,
    entity: (params) => entityOf(actividadEntity, params.id),
  },
  'umbral.create': {
    method: 'POST',
    path: () => '/api/mantenimiento/umbrales',
    failMessage: 'No se pudo crear el umbral.',
    parse: parseWith(UmbralSchema),
    invalidate: ['umbrales'],
    label: (_params, body) => etiqueta('Nuevo umbral', bodyText(body, 'tipoEquipo')),
    notFoundIsDone: false,
    carriesFiles: false,
    creates: true,
    entity: (_params, body) => entityOf(umbralEntity, bodyText(body, 'id')),
  },
  'maintenancePlan.save': {
    method: 'PUT',
    path: (params) => `/api/maintenance-plans/${param(params, 'equipmentId')}`,
    failMessage: 'No se pudo guardar la pauta de mantención.',
    parse: parseWith(MaintenancePlanViewSchema),
    invalidate: ['maintenancePlans'],
    label: (params) => etiqueta('Pauta de mantención', cachedName('equipment', params.equipmentId)),
    notFoundIsDone: false,
    carriesFiles: false,
    entity: (params) => entityOf(equipmentEntity, params.equipmentId),
  },
});
