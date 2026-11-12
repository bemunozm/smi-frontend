import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from '@heroui/react';

import { createCombustible, deleteCombustible, listCombustible, updateCombustible } from '../api/CombustibleAPI';
import type { CreateCombustibleBody, UpdateCombustibleBody } from '../api/CombustibleAPI';
import { ShiftCardAPI } from '../api/ShiftCardAPI';
import { uploadFile } from '../api/UploadsAPI';
import { mensajeErrorOperacion } from '../lib/error-messages';
import { COMBUSTIBLE_KEY as KEY, EQUIPMENT_KEY } from '../lib/query-keys';
import type { RegistroCombustible } from '../types/combustible';
import { generateUuid } from '../lib/uuid';
import type { CombustibleForm } from '../types/combustible';
import { useQueuedCreate } from './useQueuedMutation';

export function useCombustibleList() {
  return useQuery({ queryKey: KEY, queryFn: listCombustible });
}

export interface CreateCombustibleVars {
  input: Omit<CombustibleForm, 'fotoUrl' | 'fotoKey'>;
  /** Foto del surtidor (obligatoria): se guarda en el equipo y se sube al
   * sincronizar, no al elegirla — sin señal no habría cómo. */
  foto: File;
}

/**
 * Registrar una carga de combustible por la cola. La foto viaja como archivo de
 * la operación; si la subida o el POST fallan por falta de señal, todo se
 * reintenta solo. El replay refresca la lista y `['equipment']` (último nivel y
 * contadores de la ficha).
 */
export function useCreateCombustible() {
  return useQueuedCreate<'combustible.create', CreateCombustibleVars>({
    endpoint: 'combustible.create',
    build: ({ input, foto }, id) => ({ params: {}, body: { ...input, id }, files: [{ field: 'fotoKey', file: foto }] }),
    onSent: () => {
      toast.success('Carga de combustible registrada');
    },
    errorFallback: 'No se pudo registrar la carga de combustible.',
  });
}

export interface CrearCargaCombustibleVars {
  values: Omit<CreateCombustibleBody, 'id' | 'fotoKey'>;
  /** Foto del surtidor — opcional en el alta manual del panel. */
  foto: File | null;
}

/**
 * Alta directa para la vista admin de cargas (escritorio, online): sube la
 * foto solo si hay, POST inmediato + invalidación del listado — sin outbox, a
 * diferencia de `useCreateCombustible` (Terreno). El `id` lo genera el cliente
 * igual: un reintento del POST no duplica la carga. Mismo patrón que
 * `useCrearTrabajoExtra`.
 */
export function useCrearCargaCombustible() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ values, foto }: CrearCargaCombustibleVars) => {
      const fotoKey = foto ? (await uploadFile(foto)).key : undefined;
      return createCombustible({ ...values, ...(fotoKey ? { fotoKey } : {}), id: generateUuid() });
    },
    onSuccess: () => {
      toast.success('Carga de combustible registrada');
      void queryClient.invalidateQueries({ queryKey: KEY });
    },
    onError: (error: unknown) => {
      toast.danger(mensajeErrorOperacion(error, 'No se pudo registrar la carga de combustible.'));
    },
  });
}

export interface EditarCargaVars {
  carga: RegistroCombustible;
  cambios: UpdateCombustibleBody;
}

/**
 * Corrección de una carga desde el panel admin (online, solo ADMIN). El caso
 * real que motiva esto: el OCR del surtidor leyó «100.000» del display como
 * cien mil litros y la carga quedó registrada así.
 *
 * Dos caminos según el origen:
 * - MANUAL → `PATCH /combustible/:id` (litros/tipo/fecha/lectura).
 * - TARJETA → se corrige LA TARJETA (`PATCH /shift-cards/:id` con
 *   `fuelLiters`), que sincroniza la carga vinculada y deja el cambio en su
 *   historial; los litros actuales de la carga viajan como precondición
 *   (`X-Expected`) contra pisadas concurrentes. Por eso en este camino solo
 *   los litros son editables.
 */
export function useEditarCargaCombustible() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ carga, cambios }: EditarCargaVars) => {
      if (carga.registroHorometroId) {
        if (cambios.litros === undefined) return;
        await ShiftCardAPI.updateCard(
          carga.registroHorometroId,
          { fuelLiters: cambios.litros },
          { fuelLiters: carga.litros },
        );
        return;
      }
      await updateCombustible(carga.id, cambios);
    },
    onSuccess: () => {
      toast.success('Carga corregida');
      void queryClient.invalidateQueries({ queryKey: KEY });
      // La lectura corregida puede haber adelantado el contador del equipo.
      void queryClient.invalidateQueries({ queryKey: EQUIPMENT_KEY });
    },
    onError: (error: unknown) => {
      toast.danger(mensajeErrorOperacion(error, 'No se pudo corregir la carga.'));
    },
  });
}

/**
 * Eliminación definitiva de una carga (solo ADMIN): para el registro basura
 * confirmado. El backend deja la traza en el historial; una carga nacida de
 * una tarjeta deja además esa tarjeta sin litros declarados.
 */
export function useEliminarCargaCombustible() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteCombustible(id),
    onSuccess: () => {
      toast.success('Carga eliminada');
      void queryClient.invalidateQueries({ queryKey: KEY });
    },
    onError: (error: unknown) => {
      toast.danger(mensajeErrorOperacion(error, 'No se pudo eliminar la carga.'));
    },
  });
}
