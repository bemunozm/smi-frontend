import type { WriteMethod } from '../api/WriteAPI';
import { DomainError } from '../lib/api-error';
import type { QueryKeyName } from '../lib/query-keys';
import type { Hallazgo, EditHallazgoBody } from '../types/hallazgos';
import { HallazgoSchema } from '../types/hallazgos';
import type { JsonObject } from '../types/json';
import { ShiftCardResponseSchema, type EditShiftCardBody, type ShiftCardResponse } from '../types/shift';
import {
  TrabajoExtraordinarioSchema,
  type EditTrabajoExtraBody,
  type TrabajoExtraordinario,
} from '../types/trabajosExtra';
import { applyCardToCache, applyHallazgoToCache, applyTrabajoExtraToCache, cachedEquipoCode } from './cache-upserts';

/**
 * REGISTRO TIPADO de las escrituras que se pueden encolar (`httpWrite`).
 *
 * Una operación del outbox guarda solo una CLAVE de este registro más sus
 * `params`/`body`: el método, el path y lo que pasa al terminar los decide este
 * archivo. Así no existe una forma de encolar "un PATCH a cualquier URL", y
 * agregar un módulo nuevo a la cola es agregar una entrada acá.
 *
 * `EndpointMap` es la parte tipada que ve quien encola (`submitWrite`); la
 * operación guardada, en cambio, solo conserva JSON (`HttpParams`/`JsonObject`).
 */

export type HttpParams = Record<string, string>;

export interface EndpointMap {
  'shiftCard.edit': { params: { id: string }; body: EditShiftCardBody; result: ShiftCardResponse };
  'hallazgo.edit': { params: { id: string }; body: EditHallazgoBody; result: Hallazgo };
  'trabajoExtra.edit': { params: { id: string }; body: EditTrabajoExtraBody; result: TrabajoExtraordinario };
}

export type EndpointKey = keyof EndpointMap;
export type EndpointParams<K extends EndpointKey> = EndpointMap[K]['params'];
export type EndpointBody<K extends EndpointKey> = EndpointMap[K]['body'];
export type EndpointResult<K extends EndpointKey> = EndpointMap[K]['result'];

export interface EndpointDef<TResult> {
  method: WriteMethod;
  path: (params: HttpParams) => string;
  /** Mensaje cuando el servidor no trae uno propio. */
  failMessage: string;
  /** Valida lo que devolvió el servidor. `null` cuando no calza: la escritura
   * ya se aplicó, así que un cuerpo raro no puede dejar la operación trabada —
   * solo se omite la actualización inmediata del caché y el refetch lo cubre. */
  parse: (data: unknown) => TResult | null;
  /** Escribe el resultado en el caché, antes de borrar la operación. */
  apply: (result: TResult) => void;
  /** Keys que se invalidan al terminar. */
  invalidate: readonly QueryKeyName[];
  /** Texto de `SyncStatus`. */
  label: (params: HttpParams, body: JsonObject) => string;
  /** `true` para un DELETE: un 404 al reintentar significa que ya estaba hecho. */
  notFoundIsDone: boolean;
  /** `true` si la operación puede llevar archivos por subir. */
  carriesFiles: boolean;
  /** `parse` + `apply` sobre lo que devolvió el servidor — existe para que el
   * replay (que no conoce el tipo de resultado de cada clave) no tenga que
   * combinarlos. */
  applyResponse: (data: unknown) => void;
}

function defineEndpoint<T>(def: Omit<EndpointDef<T>, 'applyResponse'>): EndpointDef<T> {
  return {
    ...def,
    applyResponse: (data) => {
      const result = def.parse(data);
      if (result !== null) def.apply(result);
    },
  };
}

export type EndpointRegistry = { [K in EndpointKey]: EndpointDef<EndpointResult<K>> };

function param(params: HttpParams, name: string): string {
  const value = params[name];
  if (!value) throw new DomainError(`Falta el parámetro ${name}.`, { code: 'ENDPOINT_NOT_QUEUEABLE' });
  return encodeURIComponent(value);
}

function etiqueta(base: string, codigo: string | undefined): string {
  return codigo ? `${base} · ${codigo}` : base;
}

export const ENDPOINTS: EndpointRegistry = {
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
  }),
};

/** `true` si `key` es una entrada del registro — una operación guardada por una
 * versión futura (o dañada) puede traer una clave que este código no conoce. */
export function isEndpointKey(key: string): key is EndpointKey {
  return Object.hasOwn(ENDPOINTS, key);
}
