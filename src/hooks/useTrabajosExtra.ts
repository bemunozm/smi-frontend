import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { toast } from '@heroui/react';

import { listTrabajosExtra } from '../api/TrabajosExtraAPI';
import { useCurrentUser } from './useCurrentUser';
import { TRABAJOS_EXTRA_KEY } from '../lib/query-keys';
import { avisarGuardadoEnCola } from '../lib/outbox-feedback';
import { generateUuid } from '../lib/uuid';
import { enqueueCreateTrabajoExtra } from '../offline/outbox';
import type { TrabajoExtraForm } from '../types/trabajosExtra';

export function useTrabajosExtraList() {
  return useQuery({ queryKey: TRABAJOS_EXTRA_KEY, queryFn: listTrabajosExtra });
}

export interface UseRegistrarTrabajoExtraResult {
  /** Encola el trabajo en el outbox — SIEMPRE, con o sin señal: un único
   * camino. Los rechazos de negocio (operador inactivo, equipo con turno
   * abierto, equipo/operador inexistente) llegan después, desde el replay, a
   * la hoja de `SyncStatus` (`needs_attention`). `true` si quedó guardado. */
  registrar: (values: TrabajoExtraForm) => Promise<boolean>;
  isGuardando: boolean;
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
