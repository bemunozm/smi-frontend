import { useQuery } from '@tanstack/react-query';

import { FichaAPI } from '../api/FichaAPI';

/** Ficha consolidada de un equipo (datos técnicos + resumen + timeline). */
export function useFicha(equipoId: string) {
  return useQuery({
    queryKey: ['ficha', equipoId],
    queryFn: () => FichaAPI.getFicha(equipoId),
    enabled: !!equipoId,
  });
}
