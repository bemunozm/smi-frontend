import type { Hallazgo, EditHallazgoBody } from '../../types/hallazgos';
import { HallazgoSchema } from '../../types/hallazgos';
import { ShiftCardResponseSchema, type EditShiftCardBody, type ShiftCardResponse } from '../../types/shift';
import {
  TrabajoExtraordinarioSchema,
  type EditTrabajoExtraBody,
  type TrabajoExtraordinario,
} from '../../types/trabajosExtra';
import { applyCardToCache, applyHallazgoToCache, applyTrabajoExtraToCache, cachedEquipoCode } from '../cache-upserts';
import { hallazgoEntity, shiftCardEntity, trabajoExtraEntity } from '../db';
import { defineEndpoint, etiqueta, param, type DomainRegistry } from './define';

export interface TerrenoEndpointMap {
  'shiftCard.edit': { params: { id: string }; body: EditShiftCardBody; result: ShiftCardResponse };
  'hallazgo.edit': { params: { id: string }; body: EditHallazgoBody; result: Hallazgo };
  'trabajoExtra.edit': { params: { id: string }; body: EditTrabajoExtraBody; result: TrabajoExtraordinario };
}

export const TERRENO_ENDPOINTS: DomainRegistry<TerrenoEndpointMap> = {
  'shiftCard.edit': defineEndpoint({
    method: 'PATCH',
    path: (params) => `/api/shift-cards/${param(params, 'id')}`,
    failMessage: 'No se pudo guardar el cambio de la tarjeta.',
    parse: (data) => {
      const parsed = ShiftCardResponseSchema.safeParse(data);
      return parsed.success ? parsed.data : null;
    },
    apply: applyCardToCache,
    invalidate: ['shiftCards', 'equipment'],
    label: (params) => etiqueta('Edición de tarjeta', cachedEquipoCode('shift-card', params.id ?? '')),
    notFoundIsDone: false,
    carriesFiles: false,
    entity: (params) => (params.id ? shiftCardEntity(params.id) : undefined),
  }),
  'hallazgo.edit': defineEndpoint({
    method: 'PATCH',
    path: (params) => `/api/hallazgos/${param(params, 'id')}`,
    failMessage: 'No se pudo guardar el cambio del hallazgo.',
    parse: (data) => {
      const parsed = HallazgoSchema.safeParse(data);
      return parsed.success ? parsed.data : null;
    },
    apply: applyHallazgoToCache,
    invalidate: ['hallazgos'],
    label: (params) => etiqueta('Edición de hallazgo', cachedEquipoCode('hallazgo', params.id ?? '')),
    notFoundIsDone: false,
    carriesFiles: false,
    entity: (params) => (params.id ? hallazgoEntity(params.id) : undefined),
  }),
  'trabajoExtra.edit': defineEndpoint({
    method: 'PATCH',
    path: (params) => `/api/trabajos-extra/${param(params, 'id')}`,
    failMessage: 'No se pudo guardar el cambio del trabajo.',
    parse: (data) => {
      const parsed = TrabajoExtraordinarioSchema.safeParse(data);
      return parsed.success ? parsed.data : null;
    },
    apply: applyTrabajoExtraToCache,
    invalidate: ['trabajosExtra'],
    label: (params) => etiqueta('Edición de trabajo extra', cachedEquipoCode('trabajo-extra', params.id ?? '')),
    notFoundIsDone: false,
    carriesFiles: false,
    entity: (params) => (params.id ? trabajoExtraEntity(params.id) : undefined),
  }),
};
