import { toast } from '@heroui/react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  listTrabajosExtra,
  createTrabajoExtra,
  updateTrabajoExtra,
  listCambiosTrabajoExtra,
} from '../api/TrabajosExtraAPI';

const KEY = ['trabajos-extra'];
const cambiosKey = (id: string) => [...KEY, id, 'cambios'];

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

/**
 * Edición de un trabajo ya registrado (R13). El aviso lo dice explícito: que
 * el administrador se entera es parte de la regla, no un detalle técnico.
 */
export function useUpdateTrabajoExtra() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: updateTrabajoExtra,
    onSuccess: (_data, { id }) => {
      void qc.invalidateQueries({ queryKey: KEY });
      void qc.invalidateQueries({ queryKey: cambiosKey(id) });
      toast.success('Cambio guardado. Se avisó al administrador.');
    },
    onError: (error) => toast.danger(error.message),
  });
}

export function useCambiosTrabajoExtra(id: string | null) {
  return useQuery({
    queryKey: cambiosKey(id ?? ''),
    queryFn: () => listCambiosTrabajoExtra(id!),
    enabled: id != null,
  });
}
