import type { Hallazgo, EditHallazgoBody } from '../../types/hallazgos';
import { HallazgoSchema } from '../../types/hallazgos';
import {
  InformeTemporalSchema,
  type CreateInformeTemporalInput,
  type InformeTemporal,
  type UpdateInformeTemporalInput,
} from '../../types/informe-temporal';
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
import {
  hallazgoEntity,
  informeTemporalEntity,
  reporteDiarioEntity,
  shiftCardEntity,
  trabajoExtraEntity,
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

export interface TerrenoEndpointMap {
  'shiftCard.edit': { params: { id: string }; body: EditShiftCardBody; result: ShiftCardResponse };
  'hallazgo.edit': { params: { id: string }; body: EditHallazgoBody; result: Hallazgo };
  'trabajoExtra.edit': { params: { id: string }; body: EditTrabajoExtraBody; result: TrabajoExtraordinario };
  'reporteDiario.create': { params: NoParams; body: WithId<CreateReporteDiarioInput>; result: ReporteDiario };
  'reporteDiario.edit': { params: { id: string }; body: EditReporteDiarioBody; result: ReporteDiario };
  /** Cierre agrupado del supervisor temporal: cierra todas sus tarjetas y
   * registra el informe. Las fotos viajan como `cierres.<i>.tmpPhotoKey`. */
  'informeTemporal.create': { params: NoParams; body: CreateInformeTemporalInput; result: InformeTemporal };
  'informeTemporal.update': { params: { id: string }; body: UpdateInformeTemporalInput; result: InformeTemporal };
  'informeTemporal.delete': { params: { id: string }; body: NoParams; result: true };
}

/** Las tarjetas que cierra el informe: si la apertura de alguna sigue en la
 * cola, el informe queda detrás de ella (y se retiene si esa apertura falla). */
function tarjetasDelInforme(body: CreateInformeTemporalInput): string[] {
  const cierres: unknown = body.cierres;
  if (!Array.isArray(cierres)) return [];
  return referencias(
    ...cierres.map((cierre: unknown) => {
      const cardId = (cierre as { cardId?: unknown } | null)?.cardId;
      return entityOf(shiftCardEntity, typeof cardId === 'string' && cardId ? cardId : undefined);
    }),
  );
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
  },
  'reporteDiario.create': {
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
  'informeTemporal.create': {
    method: 'POST',
    path: () => '/api/informes-temporales',
    failMessage: 'No se pudo enviar el informe.',
    parse: parseWith(InformeTemporalSchema),
    // Cierra tarjetas: cambian las tarjetas y los contadores de los equipos.
    invalidate: ['shiftCards', 'equipment', 'informesTemporales'],
    label: (_params, body) => etiqueta('Informe supervisor temporal', bodyText(body, 'fecha')),
    notFoundIsDone: false,
    carriesFiles: true,
    creates: true,
    entity: (_params, body) => entityOf(informeTemporalEntity, bodyText(body, 'id')),
    parents: (_params, body) => tarjetasDelInforme(body),
  },
  'informeTemporal.update': {
    method: 'PATCH',
    path: (params) => `/api/informes-temporales/${param(params, 'id')}`,
    failMessage: 'No se pudo guardar la corrección del informe.',
    parse: parseWith(InformeTemporalSchema),
    invalidate: ['informesTemporales'],
    label: () => 'Corrección de informe temporal',
    notFoundIsDone: false,
    carriesFiles: false,
    entity: (params) => entityOf(informeTemporalEntity, params.id),
  },
  'informeTemporal.delete': {
    method: 'DELETE',
    path: (params) => `/api/informes-temporales/${param(params, 'id')}`,
    failMessage: 'No se pudo eliminar el informe.',
    parse: aceptarCualquiera,
    // Borra también las tarjetas del informe.
    invalidate: ['informesTemporales', 'shiftCards', 'equipment'],
    label: () => 'Eliminación de informe temporal',
    notFoundIsDone: true,
    carriesFiles: false,
    entity: (params) => entityOf(informeTemporalEntity, params.id),
  },
});
