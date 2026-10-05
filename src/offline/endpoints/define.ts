import type { z } from 'zod';

import type { WriteMethod } from '../../api/WriteAPI';
import { DomainError } from '../../lib/api-error';
import type { QueryKeyName } from '../../lib/query-keys';
import type { JsonObject } from '../../types/json';

export type HttpParams = Record<string, string>;

/** Lo que una entrada del registro declara de sí misma: la forma de sus `params`,
 * de su `body` y de lo que devuelve el servidor. */
export interface EndpointTypes {
  params: object;
  body: object;
  result: unknown;
}

/**
 * Entrada del registro tal como se escribe: `params` y `body` llevan el tipo de
 * SU endpoint, así un nombre de campo mal escrito no compila en vez de devolver
 * `undefined` en silencio (se perdería la serialización por entidad y el
 * `dependsOn` automático).
 */
export interface TypedEndpoint<T extends EndpointTypes> {
  method: WriteMethod;
  path: (params: T['params']) => string;
  /** Mensaje cuando el servidor no trae uno propio. */
  failMessage: string;
  /** Valida lo que devolvió el servidor. `null` cuando no calza: la escritura
   * ya se aplicó, así que un cuerpo raro no puede dejar la operación trabada —
   * solo se omite la actualización inmediata del caché y el refetch lo cubre. */
  parse: (data: unknown) => T['result'] | null;
  /** Escribe el resultado en el caché, antes de borrar la operación. Los
   * endpoints cuyas listas tienen muchas variantes por filtro se limitan a
   * invalidar (`invalidate`) en vez de escribir a mano cada una. */
  apply?: (result: T['result']) => void;
  /** Keys que se invalidan al terminar. */
  invalidate: readonly QueryKeyName[];
  /** Texto de la hoja de sincronización y de los avisos de "cambios sin sincronizar". */
  label: (params: T['params'], body: T['body']) => string;
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
  entity?: (params: T['params'], body: T['body']) => string | undefined;
  /** Entidades a las que esta operación hace referencia sin ser la suya (la
   * orden de una intervención, el equipo de un documento, la categoría de un
   * ítem): si su creación sigue en la cola, esta va detrás, y si esa creación se
   * rechaza o se descarta, esta se retiene o se descarta con ella. */
  parents?: (params: T['params'], body: T['body']) => string[];
  /** Campos del BODY que son la precondición del cambio (el conteo físico manda lo
   * que el usuario veía en `expectedQuantity`). "Sobrescribir" los quita para que
   * la operación valga sin importar lo que cambió mientras tanto. */
  bodyPreconditions?: readonly (keyof T['body'] & string)[];
}

/** La entrada tal como la ve el replay: `params`/`body` son el JSON que guardó
 * el outbox, sin tipo por entrada. */
export interface EndpointDef<TResult> {
  method: WriteMethod;
  path: (params: HttpParams) => string;
  failMessage: string;
  parse: (data: unknown) => TResult | null;
  apply?: (result: TResult) => void;
  invalidate: readonly QueryKeyName[];
  label: (params: HttpParams, body: JsonObject) => string;
  notFoundIsDone: boolean;
  carriesFiles: boolean;
  creates?: true;
  entity?: (params: HttpParams, body: JsonObject) => string | undefined;
  parents?: (params: HttpParams, body: JsonObject) => string[];
  bodyPreconditions?: readonly string[];
  /** `parse` + `apply` sobre lo que devolvió el servidor — existe para que el
   * replay (que no conoce el tipo de resultado de cada clave) no tenga que
   * combinarlos. */
  applyResponse: (data: unknown) => void;
}

/** Lo que cada dominio exporta: una entrada por clave de su mapa de tipos. */
export type DomainRegistry<TMap extends Record<keyof TMap, EndpointTypes>> = {
  [K in keyof TMap]: EndpointDef<TMap[K]['result']>;
};

/**
 * Pasa una entrada tipada a la forma que consume el replay. Lo que se encola sale
 * de `submitWrite`, que ya exige `params` y `body` del tipo de la clave, así que
 * recuperar ese tipo desde el JSON guardado es el único punto donde se asume.
 */
function eraseTypes<T extends EndpointTypes>(def: TypedEndpoint<T>): EndpointDef<T['result']> {
  const asParams = (params: HttpParams): T['params'] => params as unknown as T['params'];
  const asBody = (body: JsonObject): T['body'] => body as unknown as T['body'];
  return {
    method: def.method,
    path: (params) => def.path(asParams(params)),
    failMessage: def.failMessage,
    parse: def.parse,
    ...(def.apply ? { apply: def.apply } : {}),
    invalidate: def.invalidate,
    label: (params, body) => def.label(asParams(params), asBody(body)),
    notFoundIsDone: def.notFoundIsDone,
    carriesFiles: def.carriesFiles,
    ...(def.creates ? { creates: def.creates } : {}),
    ...(def.entity ? { entity: (params, body) => def.entity?.(asParams(params), asBody(body)) } : {}),
    ...(def.parents ? { parents: (params, body) => def.parents?.(asParams(params), asBody(body)) ?? [] } : {}),
    ...(def.bodyPreconditions ? { bodyPreconditions: def.bodyPreconditions } : {}),
    applyResponse: (data) => {
      const result = def.parse(data);
      if (result !== null) def.apply?.(result);
    },
  };
}

/**
 * Arma el registro de un dominio a partir de su mapa de tipos: cada entrada
 * recibe `params`/`body` tipados por su clave.
 */
export function defineDomain<TMap extends Record<keyof TMap, EndpointTypes>>(defs: {
  [K in keyof TMap]: TypedEndpoint<TMap[K]>;
}): DomainRegistry<TMap> {
  const entries = (Object.keys(defs) as (keyof TMap)[]).map((key) => [key, eraseTypes(defs[key])] as const);
  return Object.fromEntries(entries) as DomainRegistry<TMap>;
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

export function param<TParams extends object>(params: TParams, name: keyof TParams & string): string {
  const value: unknown = params[name];
  if (typeof value !== 'string' || !value) {
    throw new DomainError(`Falta el parámetro ${name}.`, { code: 'ENDPOINT_NOT_QUEUEABLE' });
  }
  return encodeURIComponent(value);
}

/** Valor de texto de `body`, o `undefined` si no está o no es un texto. */
export function bodyText<TBody extends object>(body: TBody, name: keyof TBody & string): string | undefined {
  const value: unknown = body[name];
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

/** Entidad `kind(id)` de un texto del body o de los params, o `undefined` si falta. */
export function entityOf(kind: (id: string) => string, id: string | undefined): string | undefined {
  return id ? kind(id) : undefined;
}

/** Las entidades referenciadas que sí vienen en la operación (las opcionales
 * ausentes se omiten): el valor de `parents`. */
export function referencias(...claves: (string | undefined)[]): string[] {
  return claves.filter((clave): clave is string => clave !== undefined);
}

export function etiqueta(base: string, detalle: string | undefined): string {
  return detalle ? `${base} · ${detalle}` : base;
}

/** Resultado de los endpoints cuya respuesta no se usa para nada (borrados,
 * traspaso, fijar un mínimo): lo único que importa es que se aplicaron. */
export function aceptarCualquiera(): true {
  return true;
}
