import { useQuery } from '@tanstack/react-query';
import { toast } from '@heroui/react';

import { VencimientosAPI } from '../api/VencimientosAPI';
import { EQUIPMENT_DOCUMENTS_KEY } from '../lib/query-keys';
import type { LightConfig } from '../types/vencimientos';
import { useQueuedMutation } from './useQueuedMutation';

/**
 * El calendario de vencimientos de los livianos; con `equipmentId`, solo ese
 * equipo (la tarjeta de su ficha). Cuelga de la key de documentos de equipo:
 * al cargar, editar o borrar un documento la cola invalida esa key y el
 * calendario se refresca solo.
 */
export function useCalendarioVencimientos(desde?: string, equipmentId?: string, enabled = true) {
  return useQuery({
    queryKey: [...EQUIPMENT_DOCUMENTS_KEY, 'calendario', desde ?? 'actual', equipmentId ?? 'todos'],
    queryFn: () => VencimientosAPI.calendario(desde, equipmentId),
    enabled,
  });
}

/** La configuración de mantención y avisos de un liviano (solo con la ventana abierta). */
export function useLightConfig(equipmentId: string, enabled = true) {
  return useQuery({
    queryKey: [...EQUIPMENT_DOCUMENTS_KEY, 'liviano', equipmentId],
    queryFn: () => VencimientosAPI.lightConfig(equipmentId),
    enabled,
  });
}

/**
 * Guarda «Asignar mantenciones» del liviano por la cola. El replay invalida
 * los documentos (sus días de aviso cambian) y el calendario cuelga de esa key.
 */
export function useSaveLightConfig() {
  return useQueuedMutation<'lightVehicleConfig.save', { equipmentId: string; config: LightConfig }>({
    endpoint: 'lightVehicleConfig.save',
    build: ({ equipmentId, config }) => ({ params: { equipmentId }, body: config }),
    onSent: () => {
      toast.success('Mantención del liviano guardada');
    },
    errorFallback: 'No se pudo guardar la mantención del liviano.',
  });
}
