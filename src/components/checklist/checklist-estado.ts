import { fmtNum } from '../../lib/format';
import type { DailyChecklistSummary } from '../../types/daily-checklist';

/** Etiqueta y tono del estado de un chequeo: la usan el supervisor y el panel. */
export const CHECKLIST_ESTADO: Record<
  DailyChecklistSummary['status'],
  { label: string; tono: 'warning' | 'success' | 'danger' }
> = {
  SUBMITTED: { label: 'Por validar', tono: 'warning' },
  ACCEPTED: { label: 'Aceptado', tono: 'success' },
  REJECTED: { label: 'Rechazado', tono: 'danger' },
};

/** `2.150 h` o `48.200 km`: el contador anotado, con la unidad del equipo si se conoce. */
export function contadorChecklist(c: Pick<DailyChecklistSummary, 'counter' | 'counterUnit'>): string {
  const unidad = c.counterUnit === 'KM' ? ' km' : c.counterUnit === 'HOURS' ? ' h' : '';
  return `${fmtNum(c.counter)}${unidad}`;
}
