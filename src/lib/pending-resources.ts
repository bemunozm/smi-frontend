import type { EndpointKey } from '../offline/endpoints';

type ResourceOf<K extends string> = K extends `${infer R}.${string}` ? R : never;

/** Familia de una escritura encolable: la parte de su clave antes del punto
 * (`'equipment'` en `equipment.update`). Un nombre que no exista no compila. */
export type EndpointResource = ResourceOf<EndpointKey>;

/*
 * Qué escrituras pendientes muestra cada pantalla (`usePendingWrites`,
 * `PendientesStrip`). Cada lista vive acá una sola vez: la ficha de un equipo
 * muestra lo mismo que la lista de Flota.
 */
export const RECURSOS_DE_FLOTA = [
  'equipment',
  'equipmentDocument',
  'horometro',
  'combustible',
] as const satisfies readonly EndpointResource[];

export const RECURSOS_DE_INVENTARIO = [
  'item',
  'movement',
  'stock',
  'category',
] as const satisfies readonly EndpointResource[];

export const RECURSOS_DE_FICHA_ITEM = ['item', 'movement', 'stock'] as const satisfies readonly EndpointResource[];

export const RECURSOS_DE_MOVIMIENTOS = ['movement', 'stock', 'item'] as const satisfies readonly EndpointResource[];

export const RECURSOS_DE_ACTIVIDADES = ['actividad'] as const satisfies readonly EndpointResource[];

export const RECURSOS_DE_BITACORA = ['intervencion'] as const satisfies readonly EndpointResource[];

export const RECURSOS_DE_ORDENES = ['orden', 'intervencion'] as const satisfies readonly EndpointResource[];

export const RECURSOS_DE_UMBRALES = ['umbral'] as const satisfies readonly EndpointResource[];

export const RECURSOS_DE_OPERADORES = ['operator'] as const satisfies readonly EndpointResource[];
