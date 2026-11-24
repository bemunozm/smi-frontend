import { useQuery } from '@tanstack/react-query';
import { toast } from '@heroui/react';

import { InformesTemporalesAPI } from '../api/InformesTemporalesAPI';
import { INFORMES_TEMPORALES_KEY } from '../lib/query-keys';
import type {
  CierreTemporalInput,
  CreateInformeTemporalInput,
  UpdateInformeTemporalInput,
} from '../types/informe-temporal';
import { useCurrentUser } from './useCurrentUser';
import { useQueuedDelete, useQueuedMutation } from './useQueuedMutation';

/** Informes de un rango de días (`YYYY-MM-DD`, ambos incluidos). */
export function useInformesTemporales(desde: string, hasta: string) {
  return useQuery({
    queryKey: [...INFORMES_TEMPORALES_KEY, 'list', desde, hasta],
    queryFn: () => InformesTemporalesAPI.listar(desde, hasta),
  });
}

/** Detalle de un informe; `null` = ninguno abierto (no consulta). */
export function useInformeTemporal(id: string | null) {
  return useQuery({
    queryKey: [...INFORMES_TEMPORALES_KEY, 'detalle', id],
    queryFn: () => InformesTemporalesAPI.obtener(id as string),
    enabled: id !== null,
  });
}

/** Historial de correcciones de un informe; `null` = no consulta. */
export function useInformeTemporalCambios(id: string | null) {
  return useQuery({
    queryKey: [...INFORMES_TEMPORALES_KEY, 'cambios', id],
    queryFn: () => InformesTemporalesAPI.cambios(id as string),
    enabled: id !== null,
  });
}

export interface CrearInformeTemporalVars {
  /** Con el `id` del informe y el `closeClientId` de cada cierre ya puestos por
   * el formulario: los genera UNA vez y los repite en cada reintento, así un
   * reenvío no cierra ni crea nada dos veces. */
  informe: CreateInformeTemporalInput;
  /** Foto del surtidor de cada tarjeta que la lleva, por `cardId`. */
  fotos?: Readonly<Record<string, File | null | undefined>>;
}

/** El cierre tal como lo acepta el informe: sin el turno de quien cierra (el
 * backend responde 400) y sin `tmpPhotoKey`, que pone el replay al subir la foto. */
function cierreSinTurno(cierre: CierreTemporalInput): CierreTemporalInput {
  const limpio: CierreTemporalInput & { shiftDate?: unknown; shiftType?: unknown } = { ...cierre };
  delete limpio.shiftDate;
  delete limpio.shiftType;
  delete limpio.tmpPhotoKey;
  return limpio;
}

/**
 * Envía el informe del supervisor temporal por la cola (Terreno: guarda y
 * vuelve, sin esperar al servidor). Es UNA operación: las fotos viajan como
 * archivos de ella (`cierres.<i>.tmpPhotoKey`) y, si la apertura de alguna
 * tarjeta sigue en la cola, el informe sale detrás de ella.
 */
export function useCrearInformeTemporal() {
  const { user } = useCurrentUser();
  return useQueuedMutation<'informeTemporal.create', CrearInformeTemporalVars>({
    endpoint: 'informeTemporal.create',
    waitMs: 0,
    userId: user?.id,
    build: ({ informe, fotos = {} }) => {
      const files = informe.cierres.flatMap((cierre, i) => {
        const file = fotos[cierre.cardId];
        return file ? [{ field: `cierres.${i}.tmpPhotoKey`, file }] : [];
      });
      return {
        params: {},
        body: { ...informe, cierres: informe.cierres.map(cierreSinTurno) },
        ...(files.length > 0 ? { files } : {}),
      };
    },
    onSent: () => {
      toast.success('Informe enviado');
    },
    errorFallback: 'No se pudo guardar el informe en el equipo.',
  });
}

/** Corrección de los datos de un informe ya enviado (no de sus tarjetas). */
export function useActualizarInformeTemporal() {
  return useQueuedMutation<'informeTemporal.update', { id: string; cambios: UpdateInformeTemporalInput }>({
    endpoint: 'informeTemporal.update',
    build: ({ id, cambios }) => (Object.keys(cambios).length > 0 ? { params: { id }, body: cambios } : null),
    onSent: () => {
      toast.success('Corrección guardada');
    },
    errorFallback: 'No se pudo guardar la corrección del informe.',
  });
}

/** Eliminación del informe junto con sus tarjetas. */
export function useEliminarInformeTemporal() {
  return useQueuedDelete({
    endpoint: 'informeTemporal.delete',
    sentMessage: 'Informe eliminado',
    errorFallback: 'No se pudo eliminar el informe.',
  });
}
