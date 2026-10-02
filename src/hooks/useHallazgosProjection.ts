import { useMemo } from 'react';

import { useCurrentUser } from './useCurrentUser';
import { useEquipment } from './useEquipment';
import { useHallazgosList } from './useHallazgos';
import type { CreateHallazgoOp, OutboxOp } from '../offline/db';
import { useOutboxOps } from '../offline/useOutboxOps';
import type { Equipment } from '../types/equipment';
import type { Hallazgo } from '../types/hallazgos';

/** Un hallazgo del historial: el del servidor, o uno sintético armado desde
 * una operación pendiente del outbox. */
export interface HallazgoProyectado extends Hallazgo {
  /** Viene del outbox: el servidor todavía no lo confirmó. */
  sinSincronizar?: boolean;
  /** El servidor lo rechazó por una razón de negocio — espera una acción en
   * la hoja de `SyncStatus` (Reintentar/Descartar). */
  requiereAtencion?: boolean;
  /** Lleva una foto guardada en el equipo que todavía no se subió. */
  fotoPendiente?: boolean;
}

function mapOpToHallazgo(op: CreateHallazgoOp, equipos: Equipment[]): HallazgoProyectado {
  const equipo = equipos.find((e) => e.id === op.payload.equipoId);
  return {
    id: op.id,
    equipoId: op.payload.equipoId,
    descripcion: op.payload.descripcion,
    prioridad: op.payload.prioridad,
    // Un hallazgo nace abierto (mismo criterio que el servidor).
    estado: 'ABIERTO',
    fotoUrl: null,
    // Hora de captura del dispositivo — la misma que se manda como
    // `capturedAt`, así la fila no "salta" de hora al sincronizar.
    fecha: op.payload.capturedAt,
    equipo: equipo ? { internalCode: equipo.internalCode } : undefined,
    sinSincronizar: true,
    requiereAtencion: op.status === 'needs_attention',
    fotoPendiente: op.photoId != null,
  };
}

/**
 * Historial de hallazgos = servidor + operaciones pendientes del outbox,
 * merge por `id`: el servidor gana (una operación cuyo id ya está en la lista
 * es una que el replay confirmó pero cuyo borrado en Dexie todavía no se
 * reflejó). Los pendientes van primero, el más reciente arriba. Función pura
 * para testearla sin montar React.
 */
export function proyectarHallazgos(
  servidor: Hallazgo[],
  ops: OutboxOp[],
  equipos: Equipment[],
): HallazgoProyectado[] {
  const idsServidor = new Set(servidor.map((h) => h.id));
  const pendientes = ops
    .filter((op): op is CreateHallazgoOp => op.type === 'createHallazgo' && !idsServidor.has(op.id))
    .map((op) => mapOpToHallazgo(op, equipos))
    .sort((a, b) => b.fecha.localeCompare(a.fecha));
  return [...pendientes, ...servidor];
}

export function useHallazgosProjection(): { hallazgos: HallazgoProyectado[] } {
  const { data: servidor = [] } = useHallazgosList();
  const { data: equipos = [] } = useEquipment();
  const { user } = useCurrentUser();
  const ops = useOutboxOps(user?.id);

  const hallazgos = useMemo(() => proyectarHallazgos(servidor, ops, equipos), [servidor, ops, equipos]);
  return { hallazgos };
}
