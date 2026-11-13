import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from '@heroui/react';

import {
  createTrabajoExtra,
  deleteTrabajoExtra,
  listTrabajosExtra,
  listCambiosTrabajoExtra,
} from '../api/TrabajosExtraAPI';
import { uploadFile } from '../api/UploadsAPI';
import { useCurrentUser } from './useCurrentUser';
import { useQueuedMutation } from './useQueuedMutation';
import { DomainError } from '../lib/api-error';
import { mensajeErrorOperacion } from '../lib/error-messages';
import { TRABAJOS_EXTRA_KEY } from '../lib/query-keys';
import { avisarGuardadoEnCola } from '../lib/outbox-feedback';
import { generateUuid } from '../lib/uuid';
import { toDateOnly } from '../lib/turno';
import { numeroReport } from '../lib/trabajos-extra';
import { enqueueCreateTrabajoExtra } from '../offline/outbox';
import { edicionContraBase } from '../lib/edit-diff';
import { detalleComparable } from '../lib/trabajos-extra';
import type { TrabajoExtraEdicion, TrabajoExtraForm, TrabajoExtraordinario } from '../types/trabajosExtra';

const cambiosKey = (id: string) => [...TRABAJOS_EXTRA_KEY, id, 'cambios'];

export function useTrabajosExtraList() {
  return useQuery({ queryKey: TRABAJOS_EXTRA_KEY, queryFn: listTrabajosExtra });
}

export interface UseRegistrarTrabajoExtraResult {
  /** Encola el trabajo (con la foto del report) en el outbox — SIEMPRE, con o
   * sin señal: un único camino. Los rechazos de negocio (operador inactivo,
   * equipo/operador inexistente) llegan después, desde el replay, a la hoja
   * de `SyncStatus` (`needs_attention`). `true` si quedó guardado. */
  registrar: (values: TrabajoExtraForm, foto: File) => Promise<boolean>;
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

/**
 * Creación directa para la vista de trabajos extra del administrador
 * (escritorio, online): sube la foto del report, luego POST inmediato +
 * invalidación del listado — sin outbox, a diferencia de
 * `useRegistrarTrabajoExtra` (Terreno). El `id` lo genera el cliente igual:
 * un reintento del POST no duplica el registro.
 */
export function useCrearTrabajoExtra() {
  const queryClient = useQueryClient();
  return useMutation({
    // `values.fecha` (panel, trabajo olvidado) viaja tal cual; la foto del
    // report se sube ANTES del POST y viaja como `fotoKey`.
    mutationFn: async ({ values, foto }: { values: TrabajoExtraForm & { fecha?: string }; foto: File }) => {
      const subida = await uploadFile(foto);
      return createTrabajoExtra({
        ...values,
        // Forma canónica del desglose (planta solo en filas PLANTA, horas a 2
        // decimales) — la misma normalización que aplica el servidor.
        detalle: (detalleComparable(values.detalle) ?? []) as TrabajoExtraForm['detalle'],
        fotoKey: subida.key,
        id: generateUuid(),
        capturedAt: new Date().toISOString(),
      });
    },
    onSuccess: (creado) => {
      // Dice el correlativo que le tocó: lo asigna el sistema, no el usuario.
      toast.success(creado.numero != null ? `Report ${numeroReport(creado.numero)} registrado` : 'Report registrado');
      void queryClient.invalidateQueries({ queryKey: TRABAJOS_EXTRA_KEY });
    },
    onError: (error: unknown) => {
      toast.danger(mensajeErrorTrabajoExtra(error));
    },
  });
}

export function useRegistrarTrabajoExtra(): UseRegistrarTrabajoExtraResult {
  const { user } = useCurrentUser();
  const [isGuardando, setIsGuardando] = useState(false);

  const registrar = async (values: TrabajoExtraForm, foto: File): Promise<boolean> => {
    if (isGuardando) return false;
    if (!user?.id) {
      toast.danger('No hay una sesión activa. Iniciá sesión para guardar el trabajo.');
      return false;
    }
    setIsGuardando(true);
    try {
      // `fecha` solo viaja cuando difiere de hoy (carga histórica): para los
      // registros del día, el backend conserva la hora real de captura. La
      // foto del report queda como blob junto a la op y la sube el replay.
      const { fecha, ...resto } = values;
      await enqueueCreateTrabajoExtra(
        user.id,
        {
          ...resto,
          detalle: (detalleComparable(values.detalle) ?? []) as TrabajoExtraForm['detalle'],
          ...(fecha && fecha !== toDateOnly(new Date()) ? { fecha } : {}),
          id: generateUuid(),
          capturedAt: new Date().toISOString(),
        },
        foto,
      );
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
  guardar: (original: TrabajoExtraordinario, corregido: TrabajoExtraEdicion) => Promise<boolean>;
  isGuardando: boolean;
}

const CAMPOS_TRABAJO = [
  'equipoId',
  'operatorId',
  'faena',
  'turno',
  'horometroInicial',
  'horometroFinal',
  'otraActividad',
  'descripcion',
  'observaciones',
  'reportNumero',
] as const;

/** Edición de un trabajo ya registrado por la cola. El administrador se entera
 * cuando el servidor la recibe, no al guardar. */
export function useEditarTrabajoExtra(): UseEditarTrabajoExtraResult {
  const { user } = useCurrentUser();
  const edicion = useQueuedMutation<'trabajoExtra.edit', { original: TrabajoExtraordinario; corregido: TrabajoExtraEdicion }>({
    endpoint: 'trabajoExtra.edit',
    waitMs: 0,
    userId: user?.id,
    build: ({ original, corregido }) => {
      // Un texto opcional vacío y uno ausente son lo mismo: sin esto, abrir y
      // guardar sin tocar nada marcaría `observaciones` como cambiada.
      const base = {
        equipoId: original.equipoId,
        operatorId: original.operatorId ?? '',
        faena: original.faena,
        turno: original.turno === 'NOCTURNO' ? ('NOCTURNO' as const) : ('DIURNO' as const),
        horometroInicial: original.horometroInicial,
        horometroFinal: original.horometroFinal,
        otraActividad: original.otraActividad ?? '',
        descripcion: original.descripcion,
        observaciones: original.observaciones ?? '',
        // Registros previos al folio del report: la base vacía evita marcar
        // como "cambio" lo que el formulario solo completó por primera vez...
        // pero si el usuario lo llena, sí viaja como edición.
        reportNumero: original.reportNumero ?? '',
      };
      const nuevo = {
        ...corregido,
        otraActividad: corregido.otraActividad ?? '',
        observaciones: corregido.observaciones ?? '',
      };
      const cambio = edicionContraBase(base, nuevo, CAMPOS_TRABAJO);
      // El desglose va APARTE del diff de escalares: es un arreglo de objetos
      // y la precondición `X-Expected` solo acepta primitivos. Cuando cambia,
      // viaja completo (reemplaza al vigente) y el servidor lo audita por
      // contenido; un formulario legacy que no armó la tabla no manda nada.
      const detalleBase = detalleComparable(original.detalleActividades);
      const detalleNuevo = detalleComparable(corregido.detalle);
      const detalleCambio =
        detalleNuevo !== undefined &&
        JSON.stringify(detalleBase ?? null) !== JSON.stringify(detalleNuevo);
      if (!cambio.hayCambios && !detalleCambio) return null;
      return {
        params: { id: original.id },
        body: {
          ...cambio.cambios,
          ...(detalleCambio ? { detalle: detalleNuevo as TrabajoExtraForm['detalle'] } : {}),
        },
        expected: cambio.esperado,
      };
    },
    errorFallback: 'No se pudo guardar el cambio en el equipo.',
    errorMessage: (error) => mensajeErrorTrabajoExtra(error, 'No se pudo guardar el cambio en el equipo.'),
  });

  const guardar = async (original: TrabajoExtraordinario, corregido: TrabajoExtraEdicion): Promise<boolean> => {
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

/** Eliminación definitiva de un report (solo ADMIN en el backend). */
export function useEliminarTrabajoExtra() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteTrabajoExtra(id),
    onSuccess: () => {
      toast.success('Report eliminado');
      void queryClient.invalidateQueries({ queryKey: TRABAJOS_EXTRA_KEY });
    },
    onError: (error) => {
      toast.danger(error instanceof Error ? error.message : 'No se pudo eliminar el report.');
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
