import { useQuery } from '@tanstack/react-query';
import { toast } from '@heroui/react';

import { ActividadesAPI } from '../api/MantenimientoAPI';
import { ACTIVIDADES_KEY as ACTIVIDADES_QUERY_KEY } from '../lib/query-keys';
import { buildQueuedEdit } from '../lib/queued-edit';
import { actividadEntity } from '../offline/db';
import type { Actividad, CreateActividadInput, UpdateActividadInput } from '../types/mantenimiento';
import { useQueuedCreate, useQueuedMutation } from './useQueuedMutation';

export function useActividades() {
  return useQuery({
    queryKey: ACTIVIDADES_QUERY_KEY,
    queryFn: ActividadesAPI.list,
  });
}

export function useCrearActividad() {
  return useQueuedCreate<'actividad.create', CreateActividadInput>({
    endpoint: 'actividad.create',
    build: (input, id) => ({ params: {}, body: { ...input, id } }),
    onSent: () => {
      toast.success('Actividad asignada');
    },
    errorFallback: 'No se pudo crear la actividad.',
  });
}

export interface ActualizarActividadVars {
  /** La actividad tal como la muestra la pantalla: la base de la edición. */
  actividad: Actividad;
  input: UpdateActividadInput;
}

export function useActualizarActividad() {
  return useQueuedMutation<'actividad.update', ActualizarActividadVars>({
    endpoint: 'actividad.update',
    build: async ({ actividad, input }) => {
      const edicion = await buildQueuedEdit<UpdateActividadInput>({
        entity: actividadEntity(actividad.id),
        ops: ['actividad.update'],
        base: { estado: actividad.estado },
        next: input,
        fields: ['estado'],
      });
      if (!edicion.hayCambios) return null;
      return { params: { id: actividad.id }, body: edicion.cambios, expected: edicion.esperado };
    },
    onSent: () => {
      toast.success('Actividad actualizada');
    },
    errorFallback: 'No se pudo actualizar la actividad.',
  });
}
