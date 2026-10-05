import { CATALOGOS_ENDPOINTS, type CatalogosEndpointMap } from './catalogos';
import { FLOTA_ENDPOINTS, type FlotaEndpointMap } from './flota';
import { INVENTARIO_ENDPOINTS, type InventarioEndpointMap } from './inventario';
import { MANTENIMIENTO_ENDPOINTS, type MantenimientoEndpointMap } from './mantenimiento';
import { TERRENO_ENDPOINTS, type TerrenoEndpointMap } from './terreno';
import type { EndpointDef } from './define';

export type { EndpointDef, HttpParams } from './define';

/**
 * REGISTRO TIPADO de las escrituras que se pueden encolar (`httpWrite`).
 *
 * Una operación del outbox guarda solo una CLAVE de este registro más sus
 * `params`/`body`: el método, el path y lo que pasa al terminar los decide este
 * módulo. Así no existe una forma de encolar "un PATCH a cualquier URL", y
 * agregar un módulo nuevo a la cola es agregar una entrada en el archivo de su
 * dominio (`terreno`, `flota`, `inventario`, `mantenimiento`, `catalogos`).
 *
 * `EndpointMap` es la parte tipada que ve quien encola (`submitWrite`) y la que
 * usa cada entrada para tipar sus `params`/`body` (`defineDomain`); la operación
 * guardada, en cambio, solo conserva JSON (`HttpParams`/`JsonObject`).
 *
 * Toda entrada que CREA su entidad declara `creates: true` y la `entity` que
 * crea: lo que se encole después sobre esa entidad queda detrás (`dependsOn`).
 * Las que hacen referencia a una entidad de otro catálogo (la categoría de un
 * ítem, la sucursal de un movimiento, el operador de una asignación) lo declaran
 * en `parents`, para que también queden detrás de la creación de ese catálogo.
 */
export interface EndpointMap
  extends TerrenoEndpointMap,
    FlotaEndpointMap,
    InventarioEndpointMap,
    MantenimientoEndpointMap,
    CatalogosEndpointMap {}

export type EndpointKey = keyof EndpointMap;
export type EndpointParams<K extends EndpointKey> = EndpointMap[K]['params'];
export type EndpointBody<K extends EndpointKey> = EndpointMap[K]['body'];
export type EndpointResult<K extends EndpointKey> = EndpointMap[K]['result'];

export type EndpointRegistry = { [K in EndpointKey]: EndpointDef<EndpointResult<K>> };

export const ENDPOINTS: EndpointRegistry = {
  ...TERRENO_ENDPOINTS,
  ...FLOTA_ENDPOINTS,
  ...INVENTARIO_ENDPOINTS,
  ...MANTENIMIENTO_ENDPOINTS,
  ...CATALOGOS_ENDPOINTS,
};

/**
 * Rutas que NUNCA se encolan: siguen siendo requests directas que fallan rápido
 * con el aviso de "Sin señal…" (`lib/api-error.ts#NETWORK_ERROR_MESSAGE`).
 *
 * - `/api/auth/*` y `/api/users`: contraseñas, sesiones y roles — una escritura
 *   guardada en el equipo se aplicaría después, con otra sesión y otros permisos.
 * - `/api/ocr/*`: es una sugerencia que solo sirve con la foto recién tomada.
 * - `/api/files`: la subida suelta; los archivos viajan como parte de la
 *   operación que los usa (`files` de `submitWrite`) y se suben en el replay.
 * - `/api/notifications/*`: marcar leída es un estado de la bandeja del momento.
 *
 * Las descargas y los redirects (`GET`) tampoco entran: el registro solo admite
 * `POST`/`PATCH`/`PUT`/`DELETE`. `offline/office-writes.test.ts` verifica que
 * ningún endpoint del registro caiga en esta lista.
 */
export const RUTAS_QUE_NUNCA_SE_ENCOLAN = [
  '/api/auth',
  '/api/users',
  '/api/ocr',
  '/api/files',
  '/api/notifications',
] as const;

/** `true` si `key` es una entrada del registro — una operación guardada por una
 * versión futura (o dañada) puede traer una clave que este código no conoce. */
export function isEndpointKey(key: string): key is EndpointKey {
  return Object.hasOwn(ENDPOINTS, key);
}
