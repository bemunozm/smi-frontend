import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { toast } from '@heroui/react';

import { listHallazgos, listCambiosHallazgo, type CorreccionHallazgo } from '../api/HallazgosAPI';
import { useCurrentUser } from './useCurrentUser';
import { useQueuedMutation } from './useQueuedMutation';
import { edicionContraBase } from '../lib/edit-diff';
import { HALLAZGOS_KEY } from '../lib/query-keys';
import { mensajeErrorOperacion } from '../lib/error-messages';
import { avisarGuardadoEnCola } from '../lib/outbox-feedback';
import { generateUuid } from '../lib/uuid';
import { enqueueCreateHallazgo } from '../offline/outbox';
import type { Hallazgo, HallazgoForm } from '../types/hallazgos';

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

export interface UseEditarHallazgoResult {
  /** Encola solo los campos que cambiaron respecto de `original` (lo que la
   * pantalla muestra hoy, con las ediciones pendientes ya aplicadas), con su
   * precondición. `true` si quedó guardado. */
  guardar: (original: Hallazgo, corregido: CorreccionHallazgo) => Promise<boolean>;
  isGuardando: boolean;
}

const CAMPOS_HALLAZGO = ['equipoId', 'descripcion', 'prioridad', 'estado'] as const;

/** Corrección de un hallazgo ya enviado por la cola: el aviso al administrador
 * sale cuando el servidor la recibe, no al guardar. */
export function useEditarHallazgo(): UseEditarHallazgoResult {
  const { user } = useCurrentUser();
  const edicion = useQueuedMutation<'hallazgo.edit', { original: Hallazgo; corregido: CorreccionHallazgo }>({
    endpoint: 'hallazgo.edit',
    waitMs: 0,
    userId: user?.id,
    build: ({ original, corregido }) => {
      const base: CorreccionHallazgo = {
        equipoId: original.equipoId,
        descripcion: original.descripcion,
        prioridad: original.prioridad,
        estado: original.estado,
      };
      const cambio = edicionContraBase(base, corregido, CAMPOS_HALLAZGO);
      if (!cambio.hayCambios) return null;
      return { params: { id: original.id }, body: cambio.cambios, expected: cambio.esperado };
    },
    errorFallback: 'No se pudo guardar el cambio en el equipo.',
    errorMessage: (error) => mensajeErrorOperacion(error, 'No se pudo guardar el cambio en el equipo.'),
  });

  const guardar = async (original: Hallazgo, corregido: CorreccionHallazgo): Promise<boolean> => {
    try {
      await edicion.mutateAsync({ original, corregido });
      return true;
    } catch {
      // `useQueuedMutation` ya avisó el error.
      return false;
    }
  };

  return { guardar, isGuardando: edicion.isPending };
}

export function useCambiosHallazgo(id: string | null) {
  return useQuery({
    queryKey: cambiosKey(id ?? ''),
    queryFn: () => listCambiosHallazgo(id!),
    enabled: id != null,
  });
}
