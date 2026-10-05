import { useMemo } from 'react';

import type { EndpointResource } from '../lib/pending-resources';
import {
  actividadEntity,
  branchEntity,
  categoryEntity,
  combustibleEntity,
  equipmentDocumentEntity,
  equipmentEntity,
  horometroEntity,
  intervencionEntity,
  itemEntity,
  operatorEntity,
  ordenEntity,
  umbralEntity,
  type HttpWriteOp,
} from '../offline/db';
import { useOutboxOps } from '../offline/useOutboxOps';
import { useCurrentUser } from './useCurrentUser';

export type MarcaPendiente = 'pendiente' | 'atencion';

/** La clave de entidad de cada tipo de fila, tal como la arma la cola. Las
 * pantallas piden la marca por tipo e id: el formato de la clave no sale de acá. */
const ENTITY_KEYS = {
  equipment: equipmentEntity,
  equipmentDocument: equipmentDocumentEntity,
  horometro: horometroEntity,
  combustible: combustibleEntity,
  item: itemEntity,
  category: categoryEntity,
  branch: branchEntity,
  operator: operatorEntity,
  orden: ordenEntity,
  intervencion: intervencionEntity,
  actividad: actividadEntity,
  umbral: umbralEntity,
} as const satisfies Partial<Record<EndpointResource, (id: string) => string>>;

export type PendingEntity = keyof typeof ENTITY_KEYS;

export interface PendingWrites {
  /** Escrituras de oficina del usuario que el servidor todavía no confirmó, en el
   * orden en que se mandarán. */
  ops: HttpWriteOp[];
  /** Las que esperan señal o su turno. */
  pendientes: number;
  /** Las que el servidor rechazó y esperan una acción (`needs_attention`). */
  atencion: number;
  /** Cómo marcar la fila de una entidad: `null` si no tiene nada esperando. */
  marcaDe: (entity: PendingEntity, id: string) => MarcaPendiente | null;
}

const SIN_OPS: HttpWriteOp[] = [];

/**
 * Lo que oficina tiene guardado en el equipo sin sincronizar, en vivo, filtrado
 * por `recursos` (la familia de la escritura: `'equipment'`, `'item'`,
 * `'orden'`…). Sin filtro, todo. Es lo que impide que alguien vuelva a crear algo
 * que no ve en la lista: las listas de oficina NO muestran filas optimistas, así
 * que lo pendiente se enseña aparte (`PendientesStrip`) y en la fila de la
 * entidad que ya existe (`marcaDe`).
 */
export function usePendingWrites(recursos?: readonly EndpointResource[]): PendingWrites {
  const { user } = useCurrentUser();
  const todas = useOutboxOps(user?.id);
  // El filtro llega como literal nuevo en cada render: se compara por contenido.
  const clave = recursos?.join('|');

  return useMemo(() => {
    const filtro = clave === undefined ? null : clave.split('|');
    const ops = todas.filter(
      (op): op is HttpWriteOp =>
        op.type === 'httpWrite' && (!filtro || filtro.includes(op.endpoint.split('.')[0] ?? '')),
    );
    const porEntidad = new Map<string, MarcaPendiente>();
    let atencion = 0;
    for (const op of ops) {
      const requiere = op.status === 'needs_attention';
      if (requiere) atencion += 1;
      if (!op.entityKey) continue;
      if (requiere || !porEntidad.has(op.entityKey)) porEntidad.set(op.entityKey, requiere ? 'atencion' : 'pendiente');
    }
    return {
      ops: ops.length > 0 ? ops : SIN_OPS,
      pendientes: ops.length - atencion,
      atencion,
      marcaDe: (entity, id) => porEntidad.get(ENTITY_KEYS[entity](id)) ?? null,
    };
  }, [todas, clave]);
}
