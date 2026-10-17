import { useMutation, useQuery } from '@tanstack/react-query';
import { toast } from '@heroui/react';

import { DailyChecklistAPI } from '../api/DailyChecklistAPI';
import { mensajeErrorFormulario } from '../lib/error-messages';
import { avisarGuardadoEnCola } from '../lib/outbox-feedback';
import { DAILY_CHECKLISTS_KEY } from '../lib/query-keys';
import { generateUuid } from '../lib/uuid';
import type {
  ChecklistStatus,
  ResubmitDailyChecklistInput,
  ReviewDailyChecklistInput,
  SubmitDailyChecklistInput,
} from '../types/daily-checklist';
import { writeQueued } from './useQueuedMutation';

/** El catálogo de ítems: cambia muy poco, se pide una vez por sesión. */
export function useChecklistItems() {
  return useQuery({
    queryKey: [...DAILY_CHECKLISTS_KEY, 'items'],
    queryFn: DailyChecklistAPI.items,
    staleTime: 60 * 60 * 1000,
  });
}

/** Los checklists enviados de un día (`YYYY-MM-DD`). */
export function useDailyChecklists(date: string) {
  return useQuery({
    queryKey: [...DAILY_CHECKLISTS_KEY, 'list', date],
    queryFn: () => DailyChecklistAPI.list({ date }),
  });
}

/**
 * Envía el checklist por la cola: sin señal queda guardado en el equipo con
 * sus fotos y sale solo. Las fotos van como archivos de la operación y el
 * replay pone cada key en `entries.i.photoKeys.j`.
 */
export function useSubmitDailyChecklist() {
  return useMutation({
    mutationFn: ({ input, files }: { input: SubmitDailyChecklistInput; files: { field: string; file: File }[] }) =>
      writeQueued('dailyChecklist.submit', {
        params: {},
        body: { ...input, id: generateUuid() },
        ...(files.length ? { files } : {}),
      }),
    onSuccess: (result) => {
      if (result.status === 'queued') {
        avisarGuardadoEnCola();
        return;
      }
      toast.success('Checklist enviado al supervisor');
    },
    onError: (error: unknown) => {
      toast.danger(mensajeErrorFormulario(error, 'No se pudo enviar el checklist.'));
    },
  });
}

/**
 * Los checklists en ciertos estados, de cualquier día: los pendientes del
 * supervisor (`['SUBMITTED']`) o los rechazados que el mantenedor tiene que
 * corregir (`['REJECTED']`). Se refresca solo cada minuto: el supervisor no
 * tiene campana en Terreno y la pestaña muestra cuántos esperan.
 */
export function useChecklistsPorEstado(status: readonly ChecklistStatus[], enabled = true) {
  return useQuery({
    queryKey: [...DAILY_CHECKLISTS_KEY, 'status', status.join(',')],
    queryFn: () => DailyChecklistAPI.list({ status }),
    refetchInterval: 60_000,
    enabled,
  });
}

/** El detalle de un checklist (estados, descripciones, insumos, fotos, revisiones). */
export function useChecklistDetalle(id: string | null) {
  return useQuery({
    queryKey: [...DAILY_CHECKLISTS_KEY, 'detail', id],
    queryFn: () => DailyChecklistAPI.get(id as string),
    enabled: !!id,
  });
}

/**
 * Módulo 3: el supervisor acepta (el equipo se libera) o rechaza con
 * comentario (vuelve al mantenedor). Por la cola, como todo Terreno.
 */
export function useReviewChecklist() {
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: ReviewDailyChecklistInput }) =>
      writeQueued('dailyChecklist.review', { params: { id }, body: input }),
    onSuccess: (result, { input }) => {
      if (result.status === 'queued') {
        avisarGuardadoEnCola();
        return;
      }
      toast.success(
        input.decision === 'ACCEPTED'
          ? 'Checklist aceptado: el equipo quedó liberado'
          : 'Checklist rechazado: vuelve al mantenedor',
      );
    },
    onError: (error: unknown) => {
      toast.danger(mensajeErrorFormulario(error, 'No se pudo guardar la validación.'));
    },
  });
}

/** El mantenedor reenvía un checklist rechazado ya corregido. */
export function useResubmitDailyChecklist() {
  return useMutation({
    mutationFn: ({
      id,
      input,
      files,
    }: {
      id: string;
      input: ResubmitDailyChecklistInput;
      files: { field: string; file: File }[];
    }) =>
      writeQueued('dailyChecklist.resubmit', {
        params: { id },
        body: input,
        ...(files.length ? { files } : {}),
      }),
    onSuccess: (result) => {
      if (result.status === 'queued') {
        avisarGuardadoEnCola();
        return;
      }
      toast.success('Checklist corregido y reenviado al supervisor');
    },
    onError: (error: unknown) => {
      toast.danger(mensajeErrorFormulario(error, 'No se pudo reenviar el checklist.'));
    },
  });
}
