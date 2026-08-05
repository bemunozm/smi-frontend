import { useQuery } from '@tanstack/react-query';
import { listEquipos } from '../api/equipos';

export function useEquipos() {
  return useQuery({ queryKey: ['equipos'], queryFn: listEquipos });
}
