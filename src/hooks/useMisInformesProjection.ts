import { useMemo } from 'react';

import { useCurrentUser } from './useCurrentUser';
import { useMisInformesTemporales } from './useInformesTemporales';
import type { OutboxOp } from '../offline/db';
import { useOutboxOps } from '../offline/useOutboxOps';
import { SHIFT_TYPES, type ShiftType } from '../types/shift';
import type { InformeTemporal } from '../types/informe-temporal';

/**
 * Un informe que sigue en la cola del equipo (sin señal, o esperando una
 * acción en la sincronización): todavía no tiene número ni tarjetas con
 * lecturas confirmadas, así que el historial lo muestra arriba con la marca
 * «Sin sincronizar» y sin detalle.
 */
export interface InformePendiente {
  id: string;
  /** `YYYY-MM-DD`. */
  fecha: string;
  turno: ShiftType;
  actividad1: string;
  actividad2: string | null;
  /** Cuántos equipos cierra (uno por cierre). */
  equipos: number;
  /** El servidor lo rechazó y espera Reintentar/Descartar en la sincronización. */
  requiereAtencion: boolean;
}

const texto = (v: unknown): string | undefined => (typeof v === 'string' ? v : undefined);
const esTurno = (v: unknown): v is ShiftType => typeof v === 'string' && (SHIFT_TYPES as readonly string[]).includes(v);

/**
 * Los informes pendientes del outbox que el servidor todavía no devuelve en
 * `mine` (merge por `id`: el del servidor gana, igual que `proyectarHallazgos`).
 * Del más nuevo al más viejo por fecha y, en la misma fecha, el último encolado
 * primero (`seq`, el orden de la cola). Función pura para testearla sin React.
 */
export function proyectarInformesPendientes(
  servidor: readonly InformeTemporal[],
  ops: readonly OutboxOp[],
): InformePendiente[] {
  const idsServidor = new Set(servidor.map((i) => i.id));
  const pendientes: { informe: InformePendiente; seq: number }[] = [];
  for (const op of ops) {
    if (op.type !== 'httpWrite' || op.endpoint !== 'informeTemporal.create') continue;
    const { body } = op;
    const id = texto(body.id);
    const fecha = texto(body.fecha);
    if (!id || !fecha || idsServidor.has(id)) continue;
    pendientes.push({
      informe: {
        id,
        fecha,
        turno: esTurno(body.turno) ? body.turno : 'DIURNO',
        actividad1: texto(body.actividad1)?.trim() ?? '',
        actividad2: texto(body.actividad2)?.trim() || null,
        equipos: Array.isArray(body.cierres) ? body.cierres.length : 0,
        requiereAtencion: op.status === 'needs_attention',
      },
      seq: op.seq,
    });
  }
  return pendientes
    .sort((a, b) => b.informe.fecha.localeCompare(a.informe.fecha) || b.seq - a.seq)
    .map((p) => p.informe);
}

/** Historial de reportes: los del servidor y, arriba, los que siguen en la cola. */
export function useMisInformesProjection() {
  const query = useMisInformesTemporales();
  const { user } = useCurrentUser();
  const ops = useOutboxOps(user?.id);
  const servidor = query.data;
  const pendientes = useMemo(() => proyectarInformesPendientes(servidor ?? [], ops), [servidor, ops]);
  return { ...query, informes: servidor ?? [], pendientes };
}
