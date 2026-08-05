import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { listHallazgos, createHallazgo } from '../api/HallazgosAPI';

const KEY = ['hallazgos'];

export function useHallazgosList() {
  return useQuery({ queryKey: KEY, queryFn: listHallazgos });
}

export function useCreateHallazgo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createHallazgo,
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}
