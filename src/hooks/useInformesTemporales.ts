import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { toast } from '@heroui/react';

import { InformesTemporalesAPI } from '../api/InformesTemporalesAPI';
import { INFORMES_TEMPORALES_KEY, INFORMES_TEMPORALES_MINE_KEY } from '../lib/query-keys';
import type {
  CierreTemporalInput,
  CreateInformeAntiguoInput,
  CreateInformeTemporalInput,
  UpdateInformeTemporalInput,
} from '../types/informe-temporal';
import { useCurrentUser } from './useCurrentUser';
import { useOnlineStatus } from './useOnlineStatus';
import { useQueuedDelete, useQueuedMutation } from './useQueuedMutation';

/** Informes de un rango de días (`YYYY-MM-DD`, ambos incluidos). */
export function useInformesTemporales(desde: string, hasta: string) {
  return useQuery({
    queryKey: [...INFORMES_TEMPORALES_KEY, 'list', desde, hasta],
    queryFn: () => InformesTemporalesAPI.listar(desde, hasta),
  });
}

/** El historial de reportes del supervisor temporal (los suyos, del más nuevo al más viejo). */
export function useMisInformesTemporales() {
  return useQuery({ queryKey: INFORMES_TEMPORALES_MINE_KEY, queryFn: InformesTemporalesAPI.mios });
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
 * Envía el informe del supervisor temporal por la cola. Es UNA operación: las
 * fotos viajan como archivos de ella (`cierres.<i>.tmpPhotoKey`) y, si la
 * apertura de alguna tarjeta sigue en la cola, el informe sale detrás de ella.
 *
 * Con señal espera unos segundos (`OFFICE_WAIT_MS`, el default de
 * `useQueuedMutation`): así un 409 del servidor (`INFORME_TARJETAS_DESCUADRADAS`,
 * `ID_CONFLICT`, `TEMPORAL_CARD`) rechaza la mutación con su `DomainError` y el
 * formulario lo muestra. Sin señal vuelve enseguida con `queued`.
 */
export function useCrearInformeTemporal() {
  const { user } = useCurrentUser();
  return useQueuedMutation<'informeTemporal.create', CrearInformeTemporalVars>({
    endpoint: 'informeTemporal.create',
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
      toast.success('Informe guardado');
    },
    onQueued: () => {
      toast.success('Se enviará al recuperar señal');
    },
    errorFallback: 'No se pudo guardar el informe en el equipo.',
  });
}

export interface CrearInformeAntiguoVars {
  /** Con el `id` ya puesto por el formulario: lo genera UNA vez y lo repite en
   * cada reintento, así un reenvío no crea dos informes. */
  informe: CreateInformeAntiguoInput;
  /** Foto del report en papel (opcional). */
  foto?: File | null;
}

/**
 * «Subir informe antiguo» por la cola: una operación con la foto del report
 * como archivo (`fotoKey`). Con señal espera unos segundos, así un 409
 * (`NUMERO_EN_USO`, `ID_CONFLICT`) rechaza la mutación y el formulario lo
 * muestra; sin señal vuelve con `queued` y se envía solo.
 */
export function useCrearInformeAntiguo() {
  const { user } = useCurrentUser();
  return useQueuedMutation<'informeTemporal.createAntiguo', CrearInformeAntiguoVars>({
    endpoint: 'informeTemporal.createAntiguo',
    userId: user?.id,
    build: ({ informe, foto }) => {
      const body: CreateInformeAntiguoInput = { ...informe };
      delete body.fotoKey;
      return { params: {}, body, ...(foto ? { files: [{ field: 'fotoKey', file: foto }] } : {}) };
    },
    onSent: () => {
      toast.success('Informe subido');
    },
    onQueued: () => {
      toast.success('Se enviará al recuperar señal');
    },
    errorFallback: 'No se pudo guardar el informe en el equipo.',
  });
}

/**
 * ¿Otro informe ya tiene ese N°? Con señal pregunta al servidor (medio
 * segundo después de dejar de escribir), que ve los de todos los supervisores;
 * sin señal queda `null` y el formulario se apoya en los que conoce.
 */
export function useNumeroInformeOcupado(numero: number | null): { ocupado: boolean | null } {
  const [esperado, setEsperado] = useState(numero);
  useEffect(() => {
    const t = setTimeout(() => setEsperado(numero), 500);
    return () => clearTimeout(t);
  }, [numero]);
  const enLinea = useOnlineStatus();
  const consulta = useQuery({
    queryKey: [...INFORMES_TEMPORALES_KEY, 'numero-libre', esperado],
    queryFn: () => InformesTemporalesAPI.numeroLibre(esperado!),
    enabled: enLinea && esperado != null && esperado === numero,
    staleTime: 15_000,
    retry: false,
  });
  if (numero == null || esperado !== numero || consulta.data == null) return { ocupado: null };
  return { ocupado: !consulta.data };
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
