import { useQuery } from '@tanstack/react-query';

import { getAsistencia } from '../api/AsistenciaAPI';
import { ASISTENCIA_KEY } from '../lib/query-keys';

/** La grilla de asistencia de un mes (`YYYY-MM`), ya resuelta por el backend. */
export function useAsistencia(mes: string) {
  return useQuery({ queryKey: [...ASISTENCIA_KEY, mes], queryFn: () => getAsistencia(mes) });
}
