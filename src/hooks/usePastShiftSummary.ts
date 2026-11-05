import { useQuery } from '@tanstack/react-query';

import { ShiftCardAPI } from '../api/ShiftCardAPI';
import { shiftsByDateKey } from '../lib/query-keys';
import { toDateOnly, type Turno } from '../lib/turno';
import type { ShiftSummary } from '../types/shift';

/**
 * Resumen del turno pasado elegido en Registro de equipo: qué equipos ya
 * tienen tarjeta en ese turno y si su reporte de salida ya se envió. Existe
 * porque "mis tarjetas" solo baja lo cerrado en las últimas 48 h — un turno
 * backfilleado hace una semana se vería vacío y se podría duplicar.
 *
 * `sel === null` (modo pasado inactivo) apaga la consulta. Sin señal, la
 * query queda en pausa (networkMode por defecto de TanStack) y la vista
 * simplemente no muestra el aviso: limitación documentada en el diseño.
 */
export function usePastShiftSummary(sel: { fecha: Date; turno: Turno } | null) {
  return useQuery<ShiftSummary[]>({
    queryKey: sel ? shiftsByDateKey(toDateOnly(sel.fecha), sel.turno) : ['shifts', 'by-date', 'off'],
    queryFn: () => ShiftCardAPI.listShiftsByDate(toDateOnly(sel!.fecha), sel!.turno),
    enabled: sel != null,
  });
}
