import { useQuery } from '@tanstack/react-query';
import { toast } from '@heroui/react';

import { OrdenesAPI } from '../api/MantenimientoAPI';
import { conPendientes, diferenciaEdicion, precondicion } from '../lib/edit-diff';
import { ORDENES_KEY as ORDENES_QUERY_KEY } from '../lib/query-keys';
import { generateUuid } from '../lib/uuid';
import { ordenEntity } from '../offline/db';
import { cambiosPendientes } from '../offline/outbox';
import type { CreateOrdenInput, EstadoOT, OrdenFields, OrdenTrabajo, UpdateOrdenInput } from '../types/mantenimiento';
import { useOfficeMutation } from './useOfficeMutation';

/** Lista de OT, opcionalmente filtrada por `estado` (mismo query param que el backend). */
export function useOrdenes(estado?: EstadoOT) {
  return useQuery({
    queryKey: [...ORDENES_QUERY_KEY, estado ?? 'TODAS'],
    queryFn: () => OrdenesAPI.list(estado),
  });
}

export function useOrden(id: string | undefined) {
  return useQuery({
    queryKey: [...ORDENES_QUERY_KEY, 'detalle', id],
    queryFn: () => OrdenesAPI.getById(id as string),
    enabled: !!id,
  });
}

/**
 * Mutaciones de OT — van por la cola de escrituras (`useOfficeMutation`); el
 * feedback (toast) vive acá, no en la vista. Como la lista se consulta con
 * distintos filtros de `estado` (ver `useOrdenes`), el replay invalida por
 * prefijo (`['ordenes']`) para refrescar todas las variantes cacheadas.
 */
export function useCrearOrden() {
  return useOfficeMutation<'orden.create', CreateOrdenInput>({
    endpoint: 'orden.create',
    build: (input) => ({ params: {}, body: { ...input, id: generateUuid() } }),
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

export function useActualizarOrden() {
  return useOfficeMutation<'orden.update', ActualizarOrdenVars>({
    endpoint: 'orden.update',
    build: async ({ orden, input }) => {
      const pendiente = await cambiosPendientes(ordenEntity(orden.id), ['orden.update']);
      const base = conPendientes<OrdenFields>(
        {
          estado: orden.estado,
          asignadoAId: orden.asignadoA?.id ?? null,
          prioridad: orden.prioridad,
          titulo: orden.titulo,
        },
        pendiente,
        CAMPOS_DE_ORDEN,
      );
      // Un campo que el formulario no manda es "sin cambio".
      const nuevo: OrdenFields = {
        estado: input.estado ?? base.estado,
        asignadoAId: input.asignadoAId ?? base.asignadoAId,
        prioridad: input.prioridad ?? base.prioridad,
        titulo: input.titulo ?? base.titulo,
      };
      const { cambios, esperado } = diferenciaEdicion(base, nuevo, CAMPOS_DE_ORDEN);
      if (Object.keys(cambios).length === 0) return null;
      return { params: { id: orden.id }, body: cambios, expected: precondicion(esperado) };
    },
    onSent: (data, { orden }) => {
      toast.success('Orden de trabajo actualizada', { description: data?.titulo ?? orden.titulo });
    },
    errorFallback: 'No se pudo actualizar la orden de trabajo.',
  });
}

/** Marcar/desmarcar una tarea: un set sin precondición (la última escritura gana). */
export function useToggleTarea() {
  return useOfficeMutation<'orden.toggleTarea', { ordenId: string; tareaId: string; hecha: boolean }>({
    endpoint: 'orden.toggleTarea',
    build: ({ ordenId, tareaId, hecha }) => ({ params: { ordenId, tareaId }, body: { hecha } }),
    onSent: () => {
      toast.success('Tarea actualizada');
    },
    errorFallback: 'No se pudo actualizar la tarea.',
  });
}
