import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from '@heroui/react';

import {
  createEmpresaExterna,
  deleteEmpresaExterna,
  deleteReporteDiario,
  listEmpresasExternasAdmin,
  updateEmpresaExterna,
  listCambiosReporteDiario,
  listEmpresasExternas,
  listPlantas,
  listReportesDiarios,
  type ListReportesParams,
} from '../api/ReporteDiarioAPI';
import { mensajeErrorOperacion } from '../lib/error-messages';
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

/**
 * Eliminación definitiva de un reporte (solo ADMIN): para el reporte basura
 * confirmado (duplicado, carga de prueba). El backend deja el resumen como
 * traza en el Registro de actividad. Online directa, no va por la cola.
 */
export function useEliminarReporteDiario() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteReporteDiario(id),
    onSuccess: () => {
      toast.success('Reporte eliminado');
      void queryClient.invalidateQueries({ queryKey: REPORTE_DIARIO_KEY });
    },
    onError: (error: unknown) => {
      toast.danger(mensajeErrorOperacion(error, 'No se pudo eliminar el reporte.'));
    },
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

// --- Empresas externas (CRUD del administrador) ----------------------------

const EMPRESAS_ADMIN_KEY = [...EMPRESAS_EXTERNAS_KEY, 'admin'] as const;

export function useEmpresasExternasAdmin() {
  return useQuery({ queryKey: EMPRESAS_ADMIN_KEY, queryFn: listEmpresasExternasAdmin });
}

/** Invalida la lista del admin Y la que ve el supervisor en el reporte. */
function useInvalidarEmpresas() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: EMPRESAS_EXTERNAS_KEY });
}

export function useCrearEmpresaExterna() {
  const invalidar = useInvalidarEmpresas();
  return useMutation({
    mutationFn: (nombre: string) => createEmpresaExterna(nombre),
    onSuccess: (empresa) => {
      toast.success('Empresa agregada', { description: empresa.nombre });
      void invalidar();
    },
    onError: (error: unknown) => {
      toast.danger(mensajeErrorOperacion(error, 'No se pudo agregar la empresa.'));
    },
  });
}

export function useActualizarEmpresaExterna() {
  const invalidar = useInvalidarEmpresas();
  return useMutation({
    mutationFn: ({ id, ...body }: { id: string; nombre?: string; activa?: boolean }) =>
      updateEmpresaExterna(id, body),
    onSuccess: (empresa, vars) => {
      const titulo =
        vars.activa === true ? 'Empresa reactivada' : vars.activa === false ? 'Empresa desactivada' : 'Empresa actualizada';
      toast.success(titulo, { description: empresa.nombre });
      void invalidar();
    },
    onError: (error: unknown) => {
      toast.danger(mensajeErrorOperacion(error, 'No se pudo actualizar la empresa.'));
    },
  });
}

export function useEliminarEmpresaExterna() {
  const invalidar = useInvalidarEmpresas();
  return useMutation({
    mutationFn: (id: string) => deleteEmpresaExterna(id),
    onSuccess: (resultado) => {
      if (resultado.eliminada) toast.success('Empresa eliminada');
      else toast.success('Empresa desactivada', { description: resultado.message });
      void invalidar();
    },
    onError: (error: unknown) => {
      toast.danger(mensajeErrorOperacion(error, 'No se pudo eliminar la empresa.'));
    },
  });
}
