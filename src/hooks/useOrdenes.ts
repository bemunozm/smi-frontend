import { useMutation, useQuery } from '@tanstack/react-query';
import { toast } from '@heroui/react';

import { OrdenesAPI } from '../api/MantenimientoAPI';
import { mensajeErrorFormulario } from '../lib/error-messages';
import { avisarGuardadoEnCola } from '../lib/outbox-feedback';
import { ORDENES_KEY as ORDENES_QUERY_KEY } from '../lib/query-keys';
import { buildQueuedEdit } from '../lib/queued-edit';
import { generateUuid } from '../lib/uuid';
import { ordenEntity } from '../offline/db';
import type { CreateOrdenInput, EstadoOT, OrdenFields, OrdenTrabajo, UpdateOrdenInput } from '../types/mantenimiento';
import { useQueuedCreate, useQueuedMutation, writeQueued } from './useQueuedMutation';

/** Lista de OT, opcionalmente filtrada por `estado` (mismo query param que el backend). */
export function useOrdenes(estado?: EstadoOT) {
  return useQuery({
    queryKey: [...ORDENES_QUERY_KEY, estado ?? 'TODAS'],
    queryFn: () => OrdenesAPI.list(estado),
  });
}

/**
 * Mutaciones de OT — van por la cola de escrituras (`useQueuedMutation`); el
 * feedback (toast) vive acá, no en la vista. Como la lista se consulta con
 * distintos filtros de `estado` (ver `useOrdenes`), el replay invalida por
 * prefijo (`['ordenes']`) para refrescar todas las variantes cacheadas.
 */
export function useCrearOrden() {
  return useQueuedCreate<'orden.create', CreateOrdenInput>({
    endpoint: 'orden.create',
    build: (input, id) => ({ params: {}, body: { ...input, id } }),
    onSent: (orden, input) => {
      toast.success('Orden de trabajo creada', { description: orden?.titulo ?? input.titulo });
    },
    errorFallback: 'No se pudo crear la orden de trabajo.',
  });
}

const CAMPOS_DE_ORDEN = ['estado', 'asignadoAId', 'prioridad', 'titulo'] as const;

export interface ActualizarOrdenVars {
  /** La orden tal como la muestra la pantalla: la base de la edición. */
  orden: OrdenTrabajo;
  input: UpdateOrdenInput;
}

/**
 * "Nueva operación" de la Bitácora del taller: encola la creación de la OT y,
 * detrás, su paso a EN_PROCESO (el diseño no tiene un estado intermedio
 * "pendiente" cuando se registra trabajo que ya se está haciendo). El `id` lo
 * genera el cliente, así el PATCH puede encolarse aunque el POST todavía no
 * haya viajado; la cola conserva el orden y el replay invalida `['ordenes']`
 * (registro `offline/endpoints`). Si el PATCH fallara, la orden igual existe
 * como PENDIENTE y aparece en la bandeja.
 */
export function useLogOperation() {
  return useMutation({
    mutationFn: async (input: CreateOrdenInput) => {
      const id = generateUuid();
      const created = await writeQueued('orden.create', { params: {}, body: { ...input, id } });
      const started = await writeQueued('orden.update', {
        params: { id },
        body: { estado: 'EN_PROCESO' },
      });
      return { created, started };
    },
    onSuccess: ({ created, started }, input) => {
      if (created.status === 'queued' || started.status === 'queued') {
        avisarGuardadoEnCola();
        return;
      }
      toast.success('Operación iniciada', {
        description: created.data?.titulo ?? input.titulo,
      });
    },
    onError: (error: unknown) => {
      toast.danger(mensajeErrorFormulario(error, 'No se pudo registrar la operación.'));
    },
  });
}

export function useActualizarOrden() {
  return useQueuedMutation<'orden.update', ActualizarOrdenVars>({
    endpoint: 'orden.update',
    build: async ({ orden, input }) => {
      // Un campo que el formulario no manda es "sin cambio"; `asignadoAId: null`
      // desasigna la orden.
      const edicion = await buildQueuedEdit<OrdenFields>({
        entity: ordenEntity(orden.id),
        ops: ['orden.update'],
        base: {
          estado: orden.estado,
          asignadoAId: orden.asignadoA?.id ?? null,
          prioridad: orden.prioridad,
          titulo: orden.titulo,
        },
        next: input,
        fields: CAMPOS_DE_ORDEN,
      });
      if (!edicion.hayCambios) return null;
      return { params: { id: orden.id }, body: edicion.cambios, expected: edicion.esperado };
    },
    onSent: (data, { orden }) => {
      toast.success('Orden de trabajo actualizada', { description: data?.titulo ?? orden.titulo });
    },
    errorFallback: 'No se pudo actualizar la orden de trabajo.',
  });
}

/** Marcar/desmarcar una tarea: un set sin precondición (la última escritura gana). */
export function useToggleTarea() {
  return useQueuedMutation<'orden.toggleTarea', { ordenId: string; tareaId: string; hecha: boolean }>({
    endpoint: 'orden.toggleTarea',
    build: ({ ordenId, tareaId, hecha }) => ({ params: { ordenId, tareaId }, body: { hecha } }),
    onSent: () => {
      toast.success('Tarea actualizada');
    },
    errorFallback: 'No se pudo actualizar la tarea.',
  });
}
