import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from '@heroui/react';

import { listTrabajosExtra, createTrabajoExtra } from '../api/TrabajosExtraAPI';
import { DomainError } from '../lib/api-error';
import { mensajeErrorOperacion } from '../lib/error-messages';

const KEY = ['trabajos-extra'];

export function useTrabajosExtraList() {
  return useQuery({ queryKey: KEY, queryFn: listTrabajosExtra });
}

/**
 * Mensaje amigable para un error de `createTrabajoExtra` — el operador es un
 * `operatorId` del catálogo (ver `types/trabajosExtra.ts`), así que guardar
 * puede fallar con 409 `OPERATOR_INACTIVE` (mapeado en `lib/error-messages.ts`,
 * compartido con Tarjetas de turno y la asignación de equipos) o 404 (ya no
 * existe en el catálogo) — ese 404 no trae `code` propio, así que queda como
 * contexto de este caller (ver el comentario equivalente en
 * `hooks/useEquipment.ts#mensajeErrorAsignacion`).
 */
function mensajeErrorTrabajoExtra(error: unknown): string {
  if (error instanceof DomainError && error.status === 404) {
    return 'El operador elegido ya no existe en el catálogo. Actualizá la página e intentá de nuevo.';
  }
  return mensajeErrorOperacion(error, 'No se pudo registrar el trabajo extraordinario.');
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
