import { useMemo } from 'react';

import type { HttpWriteOp } from '../offline/db';
import { useOutboxOps } from '../offline/useOutboxOps';
import { useCurrentUser } from './useCurrentUser';

export type MarcaPendiente = 'pendiente' | 'atencion';

export interface PendingWrites {
  /** Escrituras de oficina del usuario que el servidor todavía no confirmó, en el
   * orden en que se mandarán. */
  ops: HttpWriteOp[];
  /** Las que esperan señal o su turno. */
  pendientes: number;
  /** Las que el servidor rechazó y esperan una acción (`needs_attention`). */
  atencion: number;
  /** Cómo marcar la fila de una entidad: `null` si no tiene nada esperando. */
  marcaDe: (entityKey: string) => MarcaPendiente | null;
}

const SIN_OPS: HttpWriteOp[] = [];

/**
 * Lo que oficina tiene guardado en el equipo sin sincronizar, en vivo, filtrado
 * por `recursos`: la parte de la clave de endpoint antes del punto
 * (`'equipment'`, `'item'`, `'orden'`…). Sin filtro, todo. Es lo que impide que
 * alguien vuelva a crear algo que no ve en la lista: las listas de oficina NO
 * muestran filas optimistas, así que lo pendiente se enseña aparte
 * (`PendientesStrip`) y en la fila de la entidad que ya existe (`marcaDe`).
 */
export function usePendingWrites(recursos?: readonly string[]): PendingWrites {
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
      marcaDe: (entityKey) => porEntidad.get(entityKey) ?? null,
    };
  }, [todas, clave]);
}
