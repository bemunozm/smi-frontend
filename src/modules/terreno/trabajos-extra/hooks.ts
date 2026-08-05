import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { listTrabajosExtra, createTrabajoExtra } from './api';

const KEY = ['trabajos-extra'];

export function useTrabajosExtraList() {
  return useQuery({ queryKey: KEY, queryFn: listTrabajosExtra });
}

export function useCreateTrabajoExtra() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createTrabajoExtra,
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}
