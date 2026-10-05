import type { z } from 'zod';

import type { WriteMethod } from '../../api/WriteAPI';
import { DomainError } from '../../lib/api-error';
import type { QueryKeyName } from '../../lib/query-keys';
import type { JsonObject } from '../../types/json';

export type HttpParams = Record<string, string>;

export interface EndpointDef<TResult> {
  method: WriteMethod;
  path: (params: HttpParams) => string;
  /** Mensaje cuando el servidor no trae uno propio. */
  failMessage: string;
  /** Valida lo que devolvió el servidor. `null` cuando no calza: la escritura
   * ya se aplicó, así que un cuerpo raro no puede dejar la operación trabada —
   * solo se omite la actualización inmediata del caché y el refetch lo cubre. */
  parse: (data: unknown) => TResult | null;
  /** Escribe el resultado en el caché, antes de borrar la operación. Los
   * endpoints cuyas listas tienen muchas variantes por filtro se limitan a
   * invalidar (`invalidate`) en vez de escribir a mano cada una. */
  apply?: (result: TResult) => void;
  /** Keys que se invalidan al terminar. */
  invalidate: readonly QueryKeyName[];
  /** Texto de `SyncStatus` y de los avisos de "cambios sin sincronizar". */
  label: (params: HttpParams, body: JsonObject) => string;
  /** `true` para un DELETE: un 404 al reintentar significa que ya estaba hecho. */
  notFoundIsDone: boolean;
  /** `true` si la operación puede llevar archivos por subir. */
  carriesFiles: boolean;
  /** `true` si el endpoint CREA la entidad `entity(...)`: lo que se encole después
   * sobre ella queda detrás de esta operación (`dependsOn`). */
  creates?: true;
  /** Entidad sobre la que actúa la operación (`entityKey`): la que crea, si es
   * un create, o la que edita/asigna/borra/mueve. Dos operaciones con la misma
   * entidad se serializan en el replay. */
  entity?: (params: HttpParams, body: JsonObject) => string | undefined;
  /** Entidades de las que esta operación cuelga sin ser la suya (la orden de una
   * intervención, el equipo de un documento): si su creación sigue en la cola,
   * esta va detrás. */
  parents?: (params: HttpParams, body: JsonObject) => string[];
  /** `parse` + `apply` sobre lo que devolvió el servidor — existe para que el
   * replay (que no conoce el tipo de resultado de cada clave) no tenga que
   * combinarlos. */
  applyResponse: (data: unknown) => void;
}

/** Lo que cada dominio exporta: una entrada por clave de su mapa de tipos. */
export type DomainRegistry<TMap extends Record<keyof TMap, { result: unknown }>> = {
  [K in keyof TMap]: EndpointDef<TMap[K]['result']>;
};

export function defineEndpoint<T>(def: Omit<EndpointDef<T>, 'applyResponse'>): EndpointDef<T> {
  return {
    ...def,
    applyResponse: (data) => {
      const result = def.parse(data);
      if (result !== null) def.apply?.(result);
    },
  };
}

/** `parse` de un endpoint cuyo resultado es un schema de `types/`. */
export function parseWith<T>(schema: z.ZodType<T>): (data: unknown) => T | null {
  return (data) => {
    const parsed = schema.safeParse(data);
    return parsed.success ? parsed.data : null;
  };
}

/** El body de una creación lleva el `id` que genera el cliente: con él un
 * reenvío de la misma operación no duplica el registro. */
export type WithId<T> = T & { id: string };

/** Endpoints sin parámetros de ruta. */
export type NoParams = Record<string, never>;

export function param(params: HttpParams, name: string): string {
  const value = params[name];
  if (!value) throw new DomainError(`Falta el parámetro ${name}.`, { code: 'ENDPOINT_NOT_QUEUEABLE' });
  return encodeURIComponent(value);
}

/** Valor de texto de `body`, o `undefined` si no está o no es un texto. */
export function bodyText(body: JsonObject, name: string): string | undefined {
  const value = body[name];
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

export function etiqueta(base: string, detalle: string | undefined): string {
  return detalle ? `${base} · ${detalle}` : base;
}

/** Resultado de los endpoints cuya respuesta no se usa para nada (borrados,
 * traspaso, fijar un mínimo): lo único que importa es que se aplicaron. */
export function aceptarCualquiera(): true {
  return true;
}
