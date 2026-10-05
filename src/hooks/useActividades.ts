import { useQuery } from '@tanstack/react-query';
import { toast } from '@heroui/react';

import { ActividadesAPI } from '../api/MantenimientoAPI';
import { conPendientes, diferenciaEdicion, precondicion } from '../lib/edit-diff';
import { ACTIVIDADES_KEY as ACTIVIDADES_QUERY_KEY } from '../lib/query-keys';
import { generateUuid } from '../lib/uuid';
import { actividadEntity } from '../offline/db';
import { cambiosPendientes } from '../offline/outbox';
import type { Actividad, CreateActividadInput, UpdateActividadInput } from '../types/mantenimiento';
import { useOfficeMutation } from './useOfficeMutation';

export function useActividades() {
  return useQuery({
    queryKey: ACTIVIDADES_QUERY_KEY,
    queryFn: ActividadesAPI.list,
  });
}

export function useCrearActividad() {
  return useOfficeMutation<'actividad.create', CreateActividadInput>({
    endpoint: 'actividad.create',
    build: (input) => ({ params: {}, body: { ...input, id: generateUuid() } }),
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
  return useOfficeMutation<'actividad.update', ActualizarActividadVars>({
    endpoint: 'actividad.update',
    build: async ({ actividad, input }) => {
      const pendiente = await cambiosPendientes(actividadEntity(actividad.id), ['actividad.update']);
      const base = conPendientes<UpdateActividadInput>({ estado: actividad.estado }, pendiente, ['estado']);
      const { cambios, esperado } = diferenciaEdicion(base, input, ['estado']);
      if (Object.keys(cambios).length === 0) return null;
      return { params: { id: actividad.id }, body: cambios, expected: precondicion(esperado) };
    },
    onSent: () => {
      toast.success('Actividad actualizada');
    },
    errorFallback: 'No se pudo actualizar la actividad.',
  });
}
