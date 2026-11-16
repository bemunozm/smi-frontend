import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from '@heroui/react';

import { ShiftReportAPI } from '../api/ShiftReportAPI';
import { mensajeErrorOperacion } from '../lib/error-messages';
import { ACTIVITY_LOG_KEY, SHIFT_CARDS_KEY, SHIFT_REPORTS_KEY } from '../lib/query-keys';

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

/** Eliminar un reporte de salida duplicado (solo ADMIN). Refresca el registro
 * y el Registro de actividad, donde queda la traza del borrado. */
export function useDeleteShiftReport() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => ShiftReportAPI.remove(id),
    onSuccess: () => {
      toast.success('Reporte eliminado');
      void queryClient.invalidateQueries({ queryKey: SHIFT_REPORTS_KEY });
      void queryClient.invalidateQueries({ queryKey: ACTIVITY_LOG_KEY });
    },
    onError: (error: unknown) => {
      toast.danger(mensajeErrorOperacion(error, 'No se pudo eliminar el reporte.'));
    },
  });
}
