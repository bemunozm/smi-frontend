import { useQuery } from '@tanstack/react-query';

import { ShiftReportAPI } from '../api/ShiftReportAPI';
import { SHIFT_REPORTS_KEY } from '../lib/query-keys';

/** Registro de reportes de salida de turno — vista «Reportes» del admin. */
export function useShiftReports() {
  return useQuery({ queryKey: SHIFT_REPORTS_KEY, queryFn: ShiftReportAPI.list });
}
