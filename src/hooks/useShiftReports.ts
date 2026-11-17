import { useCallback } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from '@heroui/react';

import { ShiftReportAPI } from '../api/ShiftReportAPI';
import { DomainError } from '../lib/api-error';
import { mensajeErrorOperacion } from '../lib/error-messages';
import { ACTIVITY_LOG_KEY, NOTIFICACIONES_KEY, SHIFT_CARDS_KEY, SHIFT_REPORTS_KEY } from '../lib/query-keys';

/** Aviso cuando el PDF pedido ya no existe (el reporte se eliminó). */
export const REPORTE_ELIMINADO =
  'Este reporte de salida ya no existe: se eliminó (probablemente era un envío duplicado).';

/**
 * Abre el PDF de un reporte de salida en otra pestaña. La pestaña se abre en
 * el MISMO toque (si no, el navegador del celular la bloquea) y recién
 * después se le pone la URL firmada. Si el reporte ya no existe, la pestaña
 * se cierra y se avisa en la app en vez de mostrar el 404 crudo del servidor;
 * además se refrescan la lista y las notificaciones, que podían apuntar a él.
 */
export function useAbrirPdfReporte() {
  const queryClient = useQueryClient();
  return useCallback(
    (id: string) => {
      const ventana = window.open('', '_blank');
      if (ventana) {
        ventana.opener = null;
        ventana.document.title = 'Abriendo PDF…';
        ventana.document.body.textContent = 'Abriendo el PDF del reporte…';
      }
      ShiftReportAPI.signedFileUrl(id)
        .then((url) => {
          if (ventana && !ventana.closed) ventana.location.href = url;
          else window.location.assign(url);
        })
        .catch((error: unknown) => {
          ventana?.close();
          const eliminado = error instanceof DomainError && error.status === 404;
          toast.danger(eliminado ? REPORTE_ELIMINADO : mensajeErrorOperacion(error, 'No se pudo abrir el PDF del reporte.'));
          if (eliminado) {
            void queryClient.invalidateQueries({ queryKey: SHIFT_REPORTS_KEY });
            void queryClient.invalidateQueries({ queryKey: NOTIFICACIONES_KEY });
          }
        });
    },
    [queryClient],
  );
}

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
