import type { OrdenTrabajo, PrioridadOT } from '../../types/mantenimiento';

/**
 * Helpers puros del tablero del taller (diseño "Mantenedor Taller").
 * Mapeo de estados del backend a las tres columnas del diseño:
 * PENDIENTE/ASIGNADA → bandeja de hallazgos · EN_PROCESO → en proceso ·
 * COMPLETADA/CANCELADA → finalizado.
 */
export interface WorkshopBoard {
  backlog: OrdenTrabajo[];
  inProgress: OrdenTrabajo[];
  finished: OrdenTrabajo[];
}

const PRIORITY_RANK: Record<PrioridadOT, number> = {
  CRITICA: 0,
  ALTA: 1,
  MEDIA: 2,
  BAJA: 3,
};

function byDateDesc(field: 'createdAt' | 'updatedAt') {
  return (a: OrdenTrabajo, b: OrdenTrabajo) =>
    new Date(b[field]).getTime() - new Date(a[field]).getTime();
}

export function groupWorkshopBoard(ordenes: readonly OrdenTrabajo[]): WorkshopBoard {
  const backlog = ordenes
    .filter((o) => o.estado === 'PENDIENTE' || o.estado === 'ASIGNADA')
    .sort(
      (a, b) =>
        PRIORITY_RANK[a.prioridad] - PRIORITY_RANK[b.prioridad] ||
        byDateDesc('createdAt')(a, b),
    );
  const inProgress = ordenes
    .filter((o) => o.estado === 'EN_PROCESO')
    .sort(byDateDesc('updatedAt'));
  const finished = ordenes
    .filter((o) => o.estado === 'COMPLETADA' || o.estado === 'CANCELADA')
    .sort(byDateDesc('updatedAt'));
  return { backlog, inProgress, finished };
}

export interface WorkshopStats {
  backlog: number;
  inProgress: number;
  finishedToday: number;
  total: number;
}

function isSameLocalDay(iso: string, reference: Date): boolean {
  const date = new Date(iso);
  return (
    !Number.isNaN(date.getTime()) &&
    date.getFullYear() === reference.getFullYear() &&
    date.getMonth() === reference.getMonth() &&
    date.getDate() === reference.getDate()
  );
}

export function buildWorkshopStats(
  ordenes: readonly OrdenTrabajo[],
  now: Date = new Date(),
): WorkshopStats {
  const board = groupWorkshopBoard(ordenes);
  return {
    backlog: board.backlog.length,
    inProgress: board.inProgress.length,
    finishedToday: ordenes.filter(
      (o) => o.estado === 'COMPLETADA' && isSameLocalDay(o.updatedAt, now),
    ).length,
    total: ordenes.length,
  };
}

/**
 * Subset estructural de `Equipment` — lo único que el taller necesita para
 * etiquetar. `Equipment` completo lo satisface tal cual.
 */
export interface EquipmentRef {
  id: string;
  internalCode: string;
  brand: string;
  model: string;
}

/**
 * "EX-014 · CAT 320". `equipoId` en la OT es texto libre (puede ser código
 * interno o id de Flota); sin match se muestra crudo, nunca rompe.
 */
export function equipmentLabel(
  equipoId: string,
  equipment: readonly EquipmentRef[] | undefined,
): string {
  const match = equipment?.find(
    (eq) => eq.internalCode === equipoId || eq.id === equipoId,
  );
  return match ? `${match.internalCode} · ${match.brand} ${match.model}` : equipoId;
}

/** Mismo formato corto que el resto del dominio (es-CL, dd-mm hh:mm). */
export function formatDate(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime())
    ? iso
    : date.toLocaleString('es-CL', {
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      });
}
