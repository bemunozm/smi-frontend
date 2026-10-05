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
import { cachedName } from '../cache-upserts';
import { actividadEntity, intervencionEntity, ordenEntity, umbralEntity } from '../db';
import {
  bodyText,
  defineEndpoint,
  etiqueta,
  param,
  parseWith,
  type DomainRegistry,
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
}

export const MANTENIMIENTO_ENDPOINTS: DomainRegistry<MantenimientoEndpointMap> = {
  'orden.create': defineEndpoint({
    method: 'POST',
    path: () => '/api/mantenimiento/ordenes',
    failMessage: 'No se pudo crear la orden de trabajo.',
    parse: parseWith(OrdenTrabajoSchema),
    invalidate: ['ordenes'],
    label: (_params, body) => etiqueta('Nueva orden de trabajo', bodyText(body, 'titulo')),
    notFoundIsDone: false,
    carriesFiles: false,
    creates: true,
    entity: (_params, body) => {
      const id = bodyText(body, 'id');
      return id ? ordenEntity(id) : undefined;
    },
  }),
  'orden.update': defineEndpoint({
    method: 'PATCH',
    path: (params) => `/api/mantenimiento/ordenes/${param(params, 'id')}`,
    failMessage: 'No se pudo actualizar la orden de trabajo.',
    parse: parseWith(OrdenTrabajoSchema),
    invalidate: ['ordenes'],
    label: (params) => etiqueta('Edición de orden de trabajo', cachedName('orden', params.id ?? '')),
    notFoundIsDone: false,
    carriesFiles: false,
    entity: (params) => (params.id ? ordenEntity(params.id) : undefined),
  }),
  'orden.toggleTarea': defineEndpoint({
    method: 'PATCH',
    path: (params) =>
      `/api/mantenimiento/ordenes/${param(params, 'ordenId')}/tareas/${param(params, 'tareaId')}`,
    failMessage: 'No se pudo actualizar la tarea.',
    parse: parseWith(TareaSchema),
    invalidate: ['ordenes'],
    label: (params) => etiqueta('Tarea de orden de trabajo', cachedName('orden', params.ordenId ?? '')),
    notFoundIsDone: false,
    carriesFiles: false,
    entity: (params) => (params.ordenId ? ordenEntity(params.ordenId) : undefined),
  }),
  'intervencion.create': defineEndpoint({
    method: 'POST',
    path: (params) => `/api/mantenimiento/ordenes/${param(params, 'ordenId')}/intervenciones`,
    failMessage: 'No se pudo registrar la intervención.',
    parse: parseWith(IntervencionSchema),
    invalidate: ['intervenciones', 'ordenes'],
    label: (params) => etiqueta('Intervención', cachedName('orden', params.ordenId ?? '')),
    notFoundIsDone: false,
    carriesFiles: false,
    creates: true,
    entity: (_params, body) => {
      const id = bodyText(body, 'id');
      return id ? intervencionEntity(id) : undefined;
    },
    parents: (params) => (params.ordenId ? [ordenEntity(params.ordenId)] : []),
  }),
  'actividad.create': defineEndpoint({
    method: 'POST',
    path: () => '/api/mantenimiento/actividades',
    failMessage: 'No se pudo crear la actividad.',
    parse: parseWith(ActividadSchema),
    invalidate: ['actividades'],
    label: (_params, body) => etiqueta('Nueva actividad', bodyText(body, 'descripcion')),
    notFoundIsDone: false,
    carriesFiles: false,
    creates: true,
    entity: (_params, body) => {
      const id = bodyText(body, 'id');
      return id ? actividadEntity(id) : undefined;
    },
  }),
  'actividad.update': defineEndpoint({
    method: 'PATCH',
    path: (params) => `/api/mantenimiento/actividades/${param(params, 'id')}`,
    failMessage: 'No se pudo actualizar la actividad.',
    parse: parseWith(ActividadSchema),
    invalidate: ['actividades'],
    label: (params) => etiqueta('Edición de actividad', cachedName('actividad', params.id ?? '')),
    notFoundIsDone: false,
    carriesFiles: false,
    entity: (params) => (params.id ? actividadEntity(params.id) : undefined),
  }),
  'umbral.create': defineEndpoint({
    method: 'POST',
    path: () => '/api/mantenimiento/umbrales',
    failMessage: 'No se pudo crear el umbral.',
    parse: parseWith(UmbralSchema),
    invalidate: ['umbrales'],
    label: (_params, body) => etiqueta('Nuevo umbral', bodyText(body, 'tipoEquipo')),
    notFoundIsDone: false,
    carriesFiles: false,
    creates: true,
    entity: (_params, body) => {
      const id = bodyText(body, 'id');
      return id ? umbralEntity(id) : undefined;
    },
  }),
};
