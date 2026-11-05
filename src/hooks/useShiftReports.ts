import { useQuery } from '@tanstack/react-query';

import { ShiftReportAPI } from '../api/ShiftReportAPI';
import { SHIFT_CARDS_KEY, SHIFT_REPORTS_KEY } from '../lib/query-keys';

/** Registro de reportes de salida de turno — vista «Reportes» del admin. */
export function useShiftReports() {
  return useQuery({ queryKey: SHIFT_REPORTS_KEY, queryFn: ShiftReportAPI.list });
}

/**
 * Las tarjetas del turno de un reporte («Ver registro»). Cuelga de
 * `SHIFT_CARDS_KEY`: corregir una tarjeta (`shiftCard.edit` invalida esa raíz)
 * refresca la lista sola.
 */
export function useShiftReportCards(reportId: string | null) {
  return useQuery({
    queryKey: [...SHIFT_CARDS_KEY, 'report', reportId ?? ''],
    queryFn: () => ShiftReportAPI.cards(reportId!),
    enabled: reportId != null,
  });
}
