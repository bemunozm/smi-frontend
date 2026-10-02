import { toast } from '@heroui/react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { listHallazgos, createHallazgo, updateHallazgo, listCambiosHallazgo } from '../api/HallazgosAPI';

const KEY = ['hallazgos'];
const cambiosKey = (id: string) => [...KEY, id, 'cambios'];

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

/** Corrección de un hallazgo (R13): el aviso dice que el administrador se entera. */
export function useUpdateHallazgo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: updateHallazgo,
    onSuccess: (_data, { id }) => {
      void qc.invalidateQueries({ queryKey: KEY });
      void qc.invalidateQueries({ queryKey: cambiosKey(id) });
      toast.success('Cambio guardado. Se avisó al administrador.');
    },
    onError: (error) => toast.danger(error.message),
  });
}

export function useCambiosHallazgo(id: string | null) {
  return useQuery({
    queryKey: cambiosKey(id ?? ''),
    queryFn: () => listCambiosHallazgo(id!),
    enabled: id != null,
  });
}
