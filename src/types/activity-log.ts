/** Espejo de `ActivityLogService` (smi-backend/src/activity-log). */

/** De qué módulo es el evento — alimenta la etiqueta y el filtro «Módulo». */
export type ActivityKind =
  | 'FUEL_LOAD'
  | 'SHIFT_CARD'
  | 'DAILY_REPORT'
  | 'EXTRA_WORK'
  | 'FINDING'
  | 'WORK_ORDER'
  | 'MAINTENANCE'
  | 'EXIT_REPORT'
  | 'OTHER';

/** Qué se hizo. `CLOSED` cubre el cierre de tarjeta y la mantención
 * realizada; `UPDATED`/`DELETED` salen del historial de cambios. */
export type ActivityAction = 'CREATED' | 'CLOSED' | 'UPDATED' | 'DELETED';

/** Un dato editado/borrado, con los valores ya legibles (los arma el backend). */
export interface ActivityFieldChange {
  field: string;
  label: string;
  before: string;
  after: string;
}

export interface ActivityEvent {
  id: string;
  kind: ActivityKind;
  action: ActivityAction;
  /** ISO datetime — cuándo se HIZO la acción en la plataforma. */
  occurredAt: string;
  /** `YYYY-MM-DD` del día al que corresponde el DATO (día de la carga, del
   * turno, del reporte). Null cuando no aplica (ediciones). */
  dataDate: string | null;
  /** `true` cuando se registró en un día distinto al del dato (retroactivo). */
  backdated: boolean;
  actorName: string | null;
  summary: string;
  changes: ActivityFieldChange[] | null;
}

export interface ActivityFeed {
  from: string;
  to: string;
  /** Del más reciente al más antiguo. */
  events: ActivityEvent[];
}
