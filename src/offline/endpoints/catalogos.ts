import { BranchSchema, type Branch, type BranchFields, type CreateBranchInput } from '../../types/branch';
import {
  OperatorSchema,
  type CreateOperatorInput,
  type Operator,
  type OperatorFields,
} from '../../types/operator';
import { cachedName } from '../cache-upserts';
import { branchEntity, operatorEntity } from '../db';
import {
  aceptarCualquiera,
  bodyText,
  defineDomain,
  entityOf,
  etiqueta,
  param,
  parseWith,
  type NoParams,
  type WithId,
} from './define';

export interface CatalogosEndpointMap {
  'branch.create': { params: NoParams; body: WithId<CreateBranchInput>; result: Branch };
  'branch.update': { params: { id: string }; body: Partial<BranchFields>; result: Branch };
  'branch.delete': { params: { id: string }; body: NoParams; result: true };
  'operator.create': { params: NoParams; body: WithId<CreateOperatorInput>; result: Operator };
  'operator.update': { params: { id: string }; body: Partial<OperatorFields>; result: Operator };
  'operator.delete': { params: { id: string }; body: NoParams; result: true };
}

export const CATALOGOS_ENDPOINTS = defineDomain<CatalogosEndpointMap>({
  'branch.create': {
    method: 'POST',
    path: () => '/api/branches',
    failMessage: 'No se pudo crear la sucursal.',
    parse: parseWith(BranchSchema),
    invalidate: ['branches'],
    label: (_params, body) => etiqueta('Nueva sucursal', bodyText(body, 'name')),
    notFoundIsDone: false,
    carriesFiles: false,
    creates: true,
    entity: (_params, body) => entityOf(branchEntity, bodyText(body, 'id')),
  },
  'branch.update': {
    method: 'PATCH',
    path: (params) => `/api/branches/${param(params, 'id')}`,
    failMessage: 'No se pudo actualizar la sucursal.',
    parse: parseWith(BranchSchema),
    invalidate: ['branches', 'equipment'],
    label: (params) => etiqueta('Edición de sucursal', cachedName('branch', params.id)),
    notFoundIsDone: false,
    carriesFiles: false,
    entity: (params) => entityOf(branchEntity, params.id),
  },
  'branch.delete': {
    method: 'DELETE',
    path: (params) => `/api/branches/${param(params, 'id')}`,
    failMessage: 'No se pudo eliminar la sucursal.',
    parse: aceptarCualquiera,
    invalidate: ['branches'],
    label: (params) => etiqueta('Eliminación de sucursal', cachedName('branch', params.id)),
    notFoundIsDone: true,
    carriesFiles: false,
    entity: (params) => entityOf(branchEntity, params.id),
  },
  'operator.create': {
    method: 'POST',
    path: () => '/api/operators',
    failMessage: 'No se pudo crear el operador.',
    parse: parseWith(OperatorSchema),
    invalidate: ['operators'],
    label: (_params, body) => etiqueta('Nuevo operador', bodyText(body, 'name')),
    notFoundIsDone: false,
    carriesFiles: false,
    creates: true,
    entity: (_params, body) => entityOf(operatorEntity, bodyText(body, 'id')),
  },
  'operator.update': {
    method: 'PATCH',
    path: (params) => `/api/operators/${param(params, 'id')}`,
    failMessage: 'No se pudo actualizar el operador.',
    parse: parseWith(OperatorSchema),
    invalidate: ['operators'],
    label: (params) => etiqueta('Edición de operador', cachedName('operator', params.id)),
    notFoundIsDone: false,
    carriesFiles: false,
    entity: (params) => entityOf(operatorEntity, params.id),
  },
  'operator.delete': {
    method: 'DELETE',
    path: (params) => `/api/operators/${param(params, 'id')}`,
    failMessage: 'No se pudo eliminar el operador.',
    parse: aceptarCualquiera,
    invalidate: ['operators'],
    label: (params) => etiqueta('Eliminación de operador', cachedName('operator', params.id)),
    notFoundIsDone: true,
    carriesFiles: false,
    entity: (params) => entityOf(operatorEntity, params.id),
  },
});
