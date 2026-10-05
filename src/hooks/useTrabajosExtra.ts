import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { toast } from '@heroui/react';

import { listTrabajosExtra, listCambiosTrabajoExtra } from '../api/TrabajosExtraAPI';
import { useCurrentUser } from './useCurrentUser';
import { DomainError } from '../lib/api-error';
import { mensajeErrorOperacion } from '../lib/error-messages';
import { TRABAJOS_EXTRA_KEY } from '../lib/query-keys';
import { avisarGuardadoEnCola } from '../lib/outbox-feedback';
import { generateUuid } from '../lib/uuid';
import { opsDeCreacion, trabajoExtraEntity } from '../offline/db';
import { useOutboxOps } from '../offline/useOutboxOps';
import { enqueueCreateTrabajoExtra } from '../offline/outbox';
import { submitWrite } from '../offline/submit-write';
import { diferenciaEdicion, precondicion } from '../lib/edit-diff';
import type { TrabajoExtraForm, TrabajoExtraordinario } from '../types/trabajosExtra';

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

export interface UseEditarTrabajoExtraResult {
  /** Encola solo los campos que cambiaron respecto de `original` (lo que la
   * pantalla muestra hoy, con las ediciones pendientes ya aplicadas), con su
   * precondición. `true` si quedó guardado. */
  guardar: (original: TrabajoExtraordinario, corregido: TrabajoExtraForm) => Promise<boolean>;
  isGuardando: boolean;
}

const CAMPOS_TRABAJO = [
  'equipoId',
  'operatorId',
  'faena',
  'turno',
  'horometroInicial',
  'horometroFinal',
  'actividades',
  'otraActividad',
  'descripcion',
  'observaciones',
] as const;

/** Edición de un trabajo ya registrado (R13) por la cola. El administrador se
 * entera cuando el servidor la recibe, no al guardar. */
export function useEditarTrabajoExtra(): UseEditarTrabajoExtraResult {
  const { user } = useCurrentUser();
  const ops = useOutboxOps(user?.id);
  const [isGuardando, setIsGuardando] = useState(false);

  const guardar = async (original: TrabajoExtraordinario, corregido: TrabajoExtraForm): Promise<boolean> => {
    // Un texto opcional vacío y uno ausente son lo mismo: sin esto, abrir y
    // guardar sin tocar nada marcaría `observaciones` como cambiada.
    const base: TrabajoExtraForm = {
      equipoId: original.equipoId,
      operatorId: original.operatorId ?? '',
      faena: original.faena,
      turno: original.turno === 'NOCTURNO' ? 'NOCTURNO' : 'DIURNO',
      horometroInicial: original.horometroInicial,
      horometroFinal: original.horometroFinal,
      actividades: original.actividades,
      otraActividad: original.otraActividad ?? '',
      descripcion: original.descripcion,
      observaciones: original.observaciones ?? '',
    };
    const nuevo: TrabajoExtraForm = {
      ...corregido,
      otraActividad: corregido.otraActividad ?? '',
      observaciones: corregido.observaciones ?? '',
    };
    const diff = diferenciaEdicion(base, nuevo, CAMPOS_TRABAJO);
    if (Object.keys(diff.cambios).length === 0) return true;
    setIsGuardando(true);
    try {
      await submitWrite(
        'trabajoExtra.edit',
        {
          params: { id: original.id },
          body: diff.cambios,
          expected: precondicion(diff.esperado),
          entityKey: trabajoExtraEntity(original.id),
          dependsOn: opsDeCreacion(trabajoExtraEntity(original.id), ops),
        },
        { waitMs: 0, userId: user?.id },
      );
      avisarGuardadoEnCola();
      return true;
    } catch (error: unknown) {
      toast.danger(mensajeErrorTrabajoExtra(error, 'No se pudo guardar el cambio en el equipo.'));
      return false;
    } finally {
      setIsGuardando(false);
    }
  };

  return { guardar, isGuardando };
}

export function useCambiosTrabajoExtra(id: string | null) {
  return useQuery({
    queryKey: cambiosKey(id ?? ''),
    queryFn: () => listCambiosTrabajoExtra(id!),
    enabled: id != null,
  });
}
