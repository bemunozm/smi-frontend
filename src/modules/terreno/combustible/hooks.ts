import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { listCombustible, createCombustible } from './api';

const KEY = ['combustible'];

export function useCombustibleList() {
  return useQuery({ queryKey: KEY, queryFn: listCombustible });
}

export function useCreateCombustible() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createCombustible,
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}
