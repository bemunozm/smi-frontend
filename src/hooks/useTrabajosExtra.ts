import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from '@heroui/react';

import { listTrabajosExtra, createTrabajoExtra } from '../api/TrabajosExtraAPI';
import { DomainError, OPERATOR_INACTIVE_MESSAGE } from '../lib/api-error';

const KEY = ['trabajos-extra'];

export function useTrabajosExtraList() {
  return useQuery({ queryKey: KEY, queryFn: listTrabajosExtra });
}

/**
 * Mensaje amigable para un error de `createTrabajoExtra` — el operador es un
 * `operatorId` del catálogo (ver `types/trabajosExtra.ts`), así que guardar
 * puede fallar con 409 `OPERATOR_INACTIVE` (se desactivó entre que se abrió
 * el formulario y se guardó) o 404 (ya no existe en el catálogo). Mismo texto
 * que `hooks/useShiftCards.ts`/`hooks/useEquipment.ts` para
 * `OPERATOR_INACTIVE` — ver `lib/api-error.ts#OPERATOR_INACTIVE_MESSAGE`.
 */
function mensajeErrorTrabajoExtra(error: unknown): string {
  if (error instanceof DomainError) {
    if (error.code === 'OPERATOR_INACTIVE') {
      return OPERATOR_INACTIVE_MESSAGE;
    }
    if (error.status === 404) {
      return 'El operador elegido ya no existe en el catálogo. Actualizá la página e intentá de nuevo.';
    }
  }
  return error instanceof Error ? error.message : 'No se pudo registrar el trabajo extraordinario.';
}

export function useCreateTrabajoExtra() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createTrabajoExtra,
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
    onError: (error: unknown) => {
      toast.danger(mensajeErrorTrabajoExtra(error));
    },
  });
}
