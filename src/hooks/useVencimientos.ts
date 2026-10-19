import { useQuery } from '@tanstack/react-query';

import { VencimientosAPI } from '../api/VencimientosAPI';
import { EQUIPMENT_DOCUMENTS_KEY } from '../lib/query-keys';

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
