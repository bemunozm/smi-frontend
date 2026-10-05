import { useQuery } from '@tanstack/react-query';
import { toast } from '@heroui/react';

import { listHorometro } from '../api/HorometroAPI';
import { HOROMETRO_KEY as KEY } from '../lib/query-keys';
import { generateUuid } from '../lib/uuid';
import type { CerrarHorometroInput, HorometroForm } from '../types/horometro';
import { useQueuedCreate, useQueuedMutation } from './useQueuedMutation';

export function useHorometroList() {
  return useQuery({ queryKey: KEY, queryFn: listHorometro });
}

/**
 * ENTRADA del flujo de dos pasos (Flota): abre un turno. Va por la cola: el `id`
 * lo genera el cliente (el reenvío no duplica el turno) y `capturedAt` es la hora
 * del dispositivo, no la de cuando llegue al servidor. Si el equipo ya tiene un
 * turno en curso, el servidor responde `EQUIPMENT_BUSY` con su propio mensaje, que
 * llega tal cual al formulario. El replay refresca horómetro y `['equipment']`.
 */
export function useCreateHorometro() {
  return useQueuedCreate<'horometro.create', Omit<HorometroForm, 'fotoUrl'>>({
    endpoint: 'horometro.create',
    build: (payload, id) => ({
      params: {},
      body: { ...payload, id, capturedAt: new Date().toISOString() },
    }),
    onSent: () => {
      toast.success('Entrada registrada');
    },
    errorFallback: 'No se pudo registrar la entrada.',
  });
}

export interface CerrarHorometroVars {
  id: string;
  payload: Omit<CerrarHorometroInput, 'fotoUrlSalida'>;
}

/**
 * SALIDA del flujo de dos pasos (`PATCH /horometro/:id/salida`) — cierra el
 * turno abierto que devuelve `equipo.openShift`. El `closeClientId` se genera
 * UNA vez al encolar y queda guardado en la operación: un reintento reenvía el
 * mismo, así el servidor reconoce el cierre propio y no lo toma por un segundo.
 */
export function useCerrarHorometro() {
  return useQueuedMutation<'horometro.close', CerrarHorometroVars>({
    endpoint: 'horometro.close',
    build: ({ id, payload }) => ({
      params: { id },
      body: { ...payload, closeClientId: generateUuid(), capturedAt: new Date().toISOString() },
    }),
    onSent: () => {
      toast.success('Salida registrada');
    },
    errorFallback: 'No se pudo registrar la salida.',
  });
}
