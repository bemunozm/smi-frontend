import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from '@heroui/react';
import { cerrarHorometro, createHorometro, listHorometro } from '../api/HorometroAPI';
import type { CerrarHorometroInput } from '../types/horometro';

const KEY = ['horometro'];

export function useHorometroList() {
  return useQuery({ queryKey: KEY, queryFn: listHorometro });
}

export function useCreateHorometro() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createHorometro,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY });
      // La key real del dominio Equipos es `['equipment']` (ver
      // `useEquipment.ts:11`) — `['equipos']` nunca existió como query y esta
      // invalidación no refrescaba ni la tabla ni la ficha tras registrar.
      qc.invalidateQueries({ queryKey: ['equipment'] });
    },
    // Sin esto, un fallo de red/validación quedaba en silencio: el modal de
    // registro cierra optimistamente su propio estado en algunos flujos y el
    // usuario nunca se entera de que la lectura no se guardó. También es lo
    // que muestra el 400 de "el equipo ya tiene un turno en curso" (ver
    // `HorometroAPI.createHorometro`).
    onError: (error: unknown) => {
      toast.danger(error instanceof Error ? error.message : 'No se pudo registrar la entrada.');
    },
  });
}

/**
 * SALIDA del flujo de dos pasos (`PATCH /horometro/:id/salida`) — cierra el
 * turno abierto que devuelve `equipo.openShift`. Invalida el mismo árbol que
 * `useCreateHorometro`: `['equipment']` cubre lista + resumen + TODAS las
 * fichas abiertas (invalidación por prefijo, no exact match — ver
 * `useInvalidarEquipment` en `useEquipment.ts`), así que no hace falta
 * invalidar la ficha por separado.
 */
export function useCerrarHorometro() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: CerrarHorometroInput }) => cerrarHorometro(id, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY });
      qc.invalidateQueries({ queryKey: ['equipment'] });
    },
    // Surface tal cual los 404 ("no existe")/409 ("ya está cerrado")/400
    // ("la lectura final no puede ser menor que la inicial") que puede
    // responder el backend — ver `HorometroAPI.cerrarHorometro`.
    onError: (error: unknown) => {
      toast.danger(error instanceof Error ? error.message : 'No se pudo registrar la salida.');
    },
  });
}
