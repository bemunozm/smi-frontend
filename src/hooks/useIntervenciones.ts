import { useMutation, useQuery } from '@tanstack/react-query';
import { toast } from '@heroui/react';

import { IntervencionesAPI } from '../api/MantenimientoAPI';
import { mensajeErrorFormulario } from '../lib/error-messages';
import { avisarGuardadoEnCola } from '../lib/outbox-feedback';
import { INTERVENCIONES_KEY } from '../lib/query-keys';
import { generateUuid } from '../lib/uuid';
import type { EquipmentStatus } from '../types/equipment';
import type { CreateIntervencionInput, OrdenTrabajo } from '../types/mantenimiento';
import { writeQueued } from './useQueuedMutation';

function intervencionesQueryKey(ordenId: string | undefined) {
  return [...INTERVENCIONES_KEY, ordenId] as const;
}

/** Bitácora de una OT puntual — deshabilitada hasta que se elija una `ordenId`. */
export function useIntervenciones(ordenId: string | undefined) {
  return useQuery({
    queryKey: intervencionesQueryKey(ordenId),
    queryFn: () => IntervencionesAPI.list(ordenId as string),
    enabled: !!ordenId,
  });
}

/**
 * "Finalizar tarea" del taller (y «Marcar como finalizada» del panel): UNA
 * sola escritura por la cola (`orden.finalizar`) con la intervención de cierre
 * (qué se hizo + insumos + horómetro + foto), el estado en que queda el equipo
 * y, en una preventiva, la lectura de la mantención. El backend lo guarda todo
 * en una transacción: o la orden queda COMPLETADA con su cierre y su stock
 * descontado, o no cambia nada. Antes eran dos escrituras encadenadas y un
 * rechazo de la segunda dejaba la intervención guardada (stock descontado,
 * «Cierre» en la bitácora) con la orden todavía EN_PROCESO. El `id` de la
 * intervención lo genera el cliente: un reenvío de la cola no la duplica. La
 * invalidación la hace el replay (`invalidate` del registro
 * `offline/endpoints/mantenimiento`).
 */
export function useFinishTask() {
  return useMutation({
    mutationFn: ({
      orden,
      intervencion,
      foto,
      equipmentStatus,
      lecturaMantencion,
    }: {
      orden: OrdenTrabajo;
      intervencion: CreateIntervencionInput;
      /** Foto de lo realizado/ocupado: viaja como archivo del write y el
       * replay la sube e inyecta su `fotoKey` (patrón combustible). */
      foto?: File | null;
      /** Cómo queda la unidad (Operativo/Inoperativo) — el backend la aplica
       * en la misma transacción del cierre. */
      equipmentStatus?: EquipmentStatus;
      /** Solo OT PREVENTIVA: la lectura al momento de la mantención (desde ahí
       * se cuenta el próximo cambio). */
      lecturaMantencion?: number;
    }) =>
      writeQueued('orden.finalizar', {
        params: { id: orden.id },
        body: {
          ...intervencion,
          id: generateUuid(),
          ...(equipmentStatus ? { equipmentStatus } : {}),
          ...(lecturaMantencion != null ? { lecturaMantencion } : {}),
        },
        ...(foto ? { files: [{ field: 'fotoKey', file: foto }] } : {}),
      }),
    onSuccess: (resultado, { orden }) => {
      if (resultado.status === 'queued') {
        avisarGuardadoEnCola();
        return;
      }
      toast.success('Operación finalizada', { description: orden.titulo });
    },
    onError: (error: unknown) => {
      toast.danger(mensajeErrorFormulario(error, 'No se pudo finalizar la operación.'));
    },
  });
}
