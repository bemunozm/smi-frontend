import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from '@heroui/react';

import { listTrabajosExtra, updateTrabajoExtra, listCambiosTrabajoExtra } from '../api/TrabajosExtraAPI';
import { useCurrentUser } from './useCurrentUser';
import { DomainError } from '../lib/api-error';
import { mensajeErrorOperacion } from '../lib/error-messages';
import { TRABAJOS_EXTRA_KEY } from '../lib/query-keys';
import { avisarGuardadoEnCola } from '../lib/outbox-feedback';
import { generateUuid } from '../lib/uuid';
import { enqueueCreateTrabajoExtra } from '../offline/outbox';
import type { TrabajoExtraForm } from '../types/trabajosExtra';

const cambiosKey = (id: string) => [...TRABAJOS_EXTRA_KEY, id, 'cambios'];

export function useTrabajosExtraList() {
  return useQuery({ queryKey: TRABAJOS_EXTRA_KEY, queryFn: listTrabajosExtra });
}

export interface UseRegistrarTrabajoExtraResult {
  /** Encola el trabajo en el outbox — SIEMPRE, con o sin señal: un único
   * camino. Los rechazos de negocio (operador inactivo, equipo/operador
   * inexistente) llegan después, desde el replay, a la hoja de `SyncStatus`
   * (`needs_attention`). `true` si quedó guardado. */
  registrar: (values: TrabajoExtraForm) => Promise<boolean>;
  isGuardando: boolean;
}

/**
 * Mensaje amigable para un error al editar un trabajo — el operador es un
 * `operatorId` del catálogo, así que guardar puede fallar con 409
 * `OPERATOR_INACTIVE` (mapeado en `lib/error-messages.ts`) o 404 (ya no existe
 * en el catálogo); ese 404 no trae `code` propio, así que queda como contexto
 * de este caller (ver el comentario equivalente en
 * `hooks/useEquipment.ts#mensajeErrorAsignacion`).
 */
function mensajeErrorTrabajoExtra(
  error: unknown,
  fallback = 'No se pudo registrar el trabajo extraordinario.',
): string {
  if (error instanceof DomainError && error.status === 404) {
    return 'El operador elegido ya no existe en el catálogo. Actualizá la página e intentá de nuevo.';
  }
  return mensajeErrorOperacion(error, fallback);
}

export function useRegistrarTrabajoExtra(): UseRegistrarTrabajoExtraResult {
  const { user } = useCurrentUser();
  const [isGuardando, setIsGuardando] = useState(false);

  const registrar = async (values: TrabajoExtraForm): Promise<boolean> => {
    if (isGuardando) return false;
    if (!user?.id) {
      toast.danger('No hay una sesión activa. Iniciá sesión para guardar el trabajo.');
      return false;
    }
    setIsGuardando(true);
    try {
      await enqueueCreateTrabajoExtra(user.id, {
        ...values,
        id: generateUuid(),
        capturedAt: new Date().toISOString(),
      });
      avisarGuardadoEnCola();
      return true;
    } catch (error: unknown) {
      toast.danger(error instanceof Error ? error.message : 'No se pudo guardar el trabajo en el equipo.');
      return false;
    } finally {
      setIsGuardando(false);
    }
  };

  return { registrar, isGuardando };
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
      void qc.invalidateQueries({ queryKey: TRABAJOS_EXTRA_KEY });
      void qc.invalidateQueries({ queryKey: cambiosKey(id) });
      toast.success('Cambio guardado. Se avisó al administrador.');
    },
    onError: (error: unknown) => {
      toast.danger(mensajeErrorTrabajoExtra(error, 'No se pudo guardar el cambio.'));
    },
  });
}

export function useCambiosTrabajoExtra(id: string | null) {
  return useQuery({
    queryKey: cambiosKey(id ?? ''),
    queryFn: () => listCambiosTrabajoExtra(id!),
    enabled: id != null,
  });
}
