import { useQuery } from '@tanstack/react-query';
import { toast } from '@heroui/react';

import {
  listCambiosReporteDiario,
  listEmpresasExternas,
  listPlantas,
  listReportesDiarios,
  type ListReportesParams,
} from '../api/ReporteDiarioAPI';
import { EMPRESAS_EXTERNAS_KEY, PLANTAS_KEY, REPORTE_DIARIO_KEY } from '../lib/query-keys';
import type { CreateReporteDiarioInput, EditReporteDiarioBody } from '../types/reporte-diario';
import { useQueuedCreate, useQueuedMutation } from './useQueuedMutation';

export function useReportesDiarios(params?: ListReportesParams) {
  return useQuery({
    queryKey: [...REPORTE_DIARIO_KEY, params ?? {}],
    queryFn: () => listReportesDiarios(params),
  });
}

export function useReporteCambios(id: string | null) {
  return useQuery({
    queryKey: [...REPORTE_DIARIO_KEY, id, 'cambios'],
    queryFn: () => listCambiosReporteDiario(id as string),
    enabled: id !== null,
  });
}

export function usePlantas() {
  return useQuery({ queryKey: PLANTAS_KEY, queryFn: listPlantas });
}

export function useEmpresasExternas() {
  return useQuery({ queryKey: EMPRESAS_EXTERNAS_KEY, queryFn: listEmpresasExternas });
}

/** Enviar el reporte por la cola: sin señal queda encolado y se reintenta solo. */
export function useCreateReporteDiario() {
  return useQueuedCreate<'reporteDiario.create', CreateReporteDiarioInput>({
    endpoint: 'reporteDiario.create',
    build: (input, id) => ({ params: {}, body: { ...input, id } }),
    onSent: () => {
      toast.success('Reporte diario enviado');
    },
    errorFallback: 'No se pudo enviar el reporte diario.',
  });
}

export function useEditReporteDiario() {
  return useQueuedMutation<'reporteDiario.edit', { id: string; body: EditReporteDiarioBody }>({
    endpoint: 'reporteDiario.edit',
    build: ({ id, body }) => ({ params: { id }, body }),
    onSent: () => {
      toast.success('Corrección guardada');
    },
    errorFallback: 'No se pudo guardar la corrección del reporte.',
  });
}
