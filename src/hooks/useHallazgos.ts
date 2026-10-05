import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from '@heroui/react';

import { listHallazgos, updateHallazgo, listCambiosHallazgo } from '../api/HallazgosAPI';
import { useCurrentUser } from './useCurrentUser';
import { HALLAZGOS_KEY } from '../lib/query-keys';
import { mensajeErrorOperacion } from '../lib/error-messages';
import { avisarGuardadoEnCola } from '../lib/outbox-feedback';
import { generateUuid } from '../lib/uuid';
import { enqueueCreateHallazgo } from '../offline/outbox';
import type { HallazgoForm } from '../types/hallazgos';

const cambiosKey = (id: string) => [...HALLAZGOS_KEY, id, 'cambios'];

export function useHallazgosList() {
  return useQuery({ queryKey: HALLAZGOS_KEY, queryFn: listHallazgos });
}

export interface UseRegistrarHallazgoResult {
  /** Encola el hallazgo (con su foto opcional) en el outbox — SIEMPRE, con o
   * sin señal: un único camino. `true` si quedó guardado. */
  registrar: (values: HallazgoForm, foto: File | null) => Promise<boolean>;
  /** Cubre solo el encolado (un `put` a Dexie): anti-doble-toque mientras
   * `liveQuery` no alcanzó a reflejar la operación recién guardada. */
  isGuardando: boolean;
}

export function useRegistrarHallazgo(): UseRegistrarHallazgoResult {
  const { user } = useCurrentUser();
  const [isGuardando, setIsGuardando] = useState(false);

  const registrar = async (values: HallazgoForm, foto: File | null): Promise<boolean> => {
    if (isGuardando) return false;
    if (!user?.id) {
      toast.danger('No hay una sesión activa. Iniciá sesión para guardar el hallazgo.');
      return false;
    }
    setIsGuardando(true);
    try {
      await enqueueCreateHallazgo(
        user.id,
        {
          id: generateUuid(),
          equipoId: values.equipoId,
          descripcion: values.descripcion,
          prioridad: values.prioridad,
          capturedAt: new Date().toISOString(),
        },
        foto ?? undefined,
      );
      avisarGuardadoEnCola();
      return true;
    } catch (error: unknown) {
      toast.danger(error instanceof Error ? error.message : 'No se pudo guardar el hallazgo en el equipo.');
      return false;
    } finally {
      setIsGuardando(false);
    }
  };

  return { registrar, isGuardando };
}

/** Corrección de un hallazgo (R13): el aviso dice que el administrador se entera. */
export function useUpdateHallazgo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: updateHallazgo,
    onSuccess: (_data, { id }) => {
      void qc.invalidateQueries({ queryKey: HALLAZGOS_KEY });
      void qc.invalidateQueries({ queryKey: cambiosKey(id) });
      toast.success('Cambio guardado. Se avisó al administrador.');
    },
    onError: (error: unknown) => {
      toast.danger(mensajeErrorOperacion(error, 'No se pudo guardar el cambio.'));
    },
  });
}

export function useCambiosHallazgo(id: string | null) {
  return useQuery({
    queryKey: cambiosKey(id ?? ''),
    queryFn: () => listCambiosHallazgo(id!),
    enabled: id != null,
  });
}
