import type { MaintenanceStatusRow } from '../types/maintenance-plan';

export interface MantencionProxima {
  equipmentId: string;
  unit: MaintenanceStatusRow['unit'];
  /** Lo que falta para el hito (<= 0: ya toca). */
  remaining: number;
}

/**
 * Equipos con la próxima mantención dentro de su ventana de aviso
 * (`next.remaining <= alertBefore`), la más urgente primero. Fuente única de
 * la card del dashboard y de la vista Preventivo.
 */
export function mantencionesProximas(filas: Iterable<MaintenanceStatusRow>): MantencionProxima[] {
  return [...filas]
    .flatMap((fila) =>
      fila.alertBefore !== null && fila.status.next && fila.status.next.remaining <= fila.alertBefore
        ? [{ equipmentId: fila.equipmentId, unit: fila.unit, remaining: fila.status.next.remaining }]
        : [],
    )
    .sort((a, b) => a.remaining - b.remaining);
}
