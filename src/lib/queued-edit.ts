import { cambiosPendientes } from '../offline/outbox';
import type { EndpointKey } from '../offline/endpoints';
import type { JsonValue } from '../types/json';
import { conPendientes, edicionContraBase, type EdicionContraBase } from './edit-diff';

export interface QueuedEditSpec<T extends { [K in keyof T]?: JsonValue }> {
  /** Entidad que se edita (`offline/db#*Entity`). */
  entity: string;
  /** Las escrituras de esa entidad que dejan los campos como los dejará la cola. */
  ops: readonly EndpointKey[];
  /** Lo que la pantalla muestra hoy de la entidad. */
  base: T;
  /** Lo que quedó en el formulario; los campos que no trae no se tocan. */
  next: Partial<T>;
  fields: readonly (keyof T & string)[];
}

/**
 * La base de una edición: lo que la pantalla muestra más lo que esa misma
 * entidad ya tiene esperando en la cola. Sin esto, dos ediciones seguidas sin
 * señal del mismo campo compararían la segunda contra el valor que el servidor
 * tiene HOY y chocarían con la primera al sincronizar.
 */
export async function pendingBase<T extends { [K in keyof T]?: JsonValue }>(
  spec: Pick<QueuedEditSpec<T>, 'entity' | 'ops' | 'base' | 'fields'>,
): Promise<T> {
  const pendiente = await cambiosPendientes(spec.entity, spec.ops);
  return conPendientes(spec.base, pendiente, spec.fields);
}

/**
 * Único camino para armar una edición encolable: base con pendientes, solo los
 * campos que cambiaron y su precondición. El llamador decide qué hacer cuando
 * `hayCambios` es `false` (normalmente, no encolar nada).
 */
export async function buildQueuedEdit<T extends { [K in keyof T]?: JsonValue }>(
  spec: QueuedEditSpec<T>,
): Promise<EdicionContraBase<T>> {
  return edicionContraBase(await pendingBase(spec), spec.next, spec.fields);
}
