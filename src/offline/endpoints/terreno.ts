import type { Hallazgo, EditHallazgoBody } from '../../types/hallazgos';
import { HallazgoSchema } from '../../types/hallazgos';
import {
  ReporteDiarioSchema,
  type CreateReporteDiarioInput,
  type EditReporteDiarioBody,
  type ReporteDiario,
} from '../../types/reporte-diario';
import { ShiftCardResponseSchema, type EditShiftCardBody, type ShiftCardResponse } from '../../types/shift';
import {
  TrabajoExtraordinarioSchema,
  type EditTrabajoExtraBody,
  type TrabajoExtraordinario,
} from '../../types/trabajosExtra';
import { applyCardToCache, applyHallazgoToCache, applyTrabajoExtraToCache, cachedEquipoCode } from '../cache-upserts';
import { hallazgoEntity, reporteDiarioEntity, shiftCardEntity, trabajoExtraEntity } from '../db';
import {
  bodyText,
  defineDomain,
  entityOf,
  etiqueta,
  param,
  parseWith,
  type NoParams,
  type WithId,
} from './define';

export interface TerrenoEndpointMap {
  'shiftCard.edit': { params: { id: string }; body: EditShiftCardBody; result: ShiftCardResponse };
  'hallazgo.edit': { params: { id: string }; body: EditHallazgoBody; result: Hallazgo };
  'trabajoExtra.edit': { params: { id: string }; body: EditTrabajoExtraBody; result: TrabajoExtraordinario };
  'reporteDiario.create': { params: NoParams; body: WithId<CreateReporteDiarioInput>; result: ReporteDiario };
  'reporteDiario.edit': { params: { id: string }; body: EditReporteDiarioBody; result: ReporteDiario };
}

export const TERRENO_ENDPOINTS = defineDomain<TerrenoEndpointMap>({
  'shiftCard.edit': {
    method: 'PATCH',
    path: (params) => `/api/shift-cards/${param(params, 'id')}`,
    failMessage: 'No se pudo guardar el cambio de la tarjeta.',
    parse: parseWith(ShiftCardResponseSchema),
    apply: applyCardToCache,
    invalidate: ['shiftCards', 'equipment'],
    label: (params) => etiqueta('Edición de tarjeta', cachedEquipoCode('shift-card', params.id)),
    notFoundIsDone: false,
    carriesFiles: false,
    entity: (params) => entityOf(shiftCardEntity, params.id),
  },
  'hallazgo.edit': {
    method: 'PATCH',
    path: (params) => `/api/hallazgos/${param(params, 'id')}`,
    failMessage: 'No se pudo guardar el cambio del hallazgo.',
    parse: parseWith(HallazgoSchema),
    apply: applyHallazgoToCache,
    invalidate: ['hallazgos'],
    label: (params) => etiqueta('Edición de hallazgo', cachedEquipoCode('hallazgo', params.id)),
    notFoundIsDone: false,
    carriesFiles: false,
    entity: (params) => entityOf(hallazgoEntity, params.id),
  },
  'trabajoExtra.edit': {
    method: 'PATCH',
    path: (params) => `/api/trabajos-extra/${param(params, 'id')}`,
    failMessage: 'No se pudo guardar el cambio del trabajo.',
    parse: parseWith(TrabajoExtraordinarioSchema),
    apply: applyTrabajoExtraToCache,
    invalidate: ['trabajosExtra'],
    label: (params) => etiqueta('Edición de trabajo extra', cachedEquipoCode('trabajo-extra', params.id)),
    notFoundIsDone: false,
    carriesFiles: false,
    entity: (params) => entityOf(trabajoExtraEntity, params.id),
  },  'reporteDiario.create': {
    method: 'POST',
    path: () => '/api/reporte-diario',
    failMessage: 'No se pudo enviar el reporte diario.',
    parse: parseWith(ReporteDiarioSchema),
    invalidate: ['reporteDiario'],
    label: (_params, body) => etiqueta('Reporte diario', bodyText(body, 'fecha')),
    notFoundIsDone: false,
    carriesFiles: false,
    creates: true,
    entity: (_params, body) => entityOf(reporteDiarioEntity, bodyText(body, 'id')),
  },
  'reporteDiario.edit': {
    method: 'PATCH',
    path: (params) => `/api/reporte-diario/${param(params, 'id')}`,
    failMessage: 'No se pudo guardar la corrección del reporte.',
    parse: parseWith(ReporteDiarioSchema),
    invalidate: ['reporteDiario'],
    label: () => 'Corrección de reporte diario',
    notFoundIsDone: false,
    carriesFiles: false,
    entity: (params) => entityOf(reporteDiarioEntity, params.id),
  },
});
