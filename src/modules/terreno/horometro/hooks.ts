import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { listHorometro, createHorometro } from './api';

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
      qc.invalidateQueries({ queryKey: ['equipos'] });
    },
  });
}
