import { toast } from '@heroui/react';
import { useQuery } from '@tanstack/react-query';

import { MaintenanceForecastAPI } from '../api/MaintenanceForecastAPI';
import { MaintenancePlanAPI } from '../api/MaintenancePlanAPI';
import { MAINTENANCE_PLANS_KEY } from '../lib/query-keys';
import type { CorregirUltimoCambioInput } from '../types/maintenance-board';
import type { SaveMaintenancePlanInput, SetMaintenanceRecordInput } from '../types/maintenance-plan';
import { useQueuedMutation } from './useQueuedMutation';

/** La pauta de un equipo. Solo se pide con la ventana abierta (`enabled`). */
export function useMaintenancePlan(equipmentId: string, enabled = true) {
  return useQuery({
    queryKey: [...MAINTENANCE_PLANS_KEY, equipmentId],
    queryFn: () => MaintenancePlanAPI.get(equipmentId),
    enabled,
  });
}

/**
 * La próxima mantención de cada equipo con pauta, indexada por equipo: la
 * tabla de Equipos la muestra en cada fila sin pedirla de a una.
 */
export function useMaintenanceStatusByEquipment(enabled = true) {
  return useQuery({
    queryKey: [...MAINTENANCE_PLANS_KEY, 'status'],
    queryFn: MaintenancePlanAPI.statusForAll,
    select: (filas) => new Map(filas.map((f) => [f.equipmentId, f])),
    enabled,
  });
}

/**
 * Fecha estimada de la próxima mantención de cada equipo, por uso promedio.
 * Cuelga de la misma raíz que las pautas: guardar una pauta la recalcula.
 */
export function useMaintenanceForecastByEquipment(enabled = true) {
  return useQuery({
    queryKey: [...MAINTENANCE_PLANS_KEY, 'forecast'],
    queryFn: MaintenanceForecastAPI.list,
    select: (filas) => new Map(filas.map((f) => [f.equipmentId, f])),
    enabled,
  });
}

/**
 * La pizarra de mantenciones. Cuelga de la raíz de las pautas: guardar una
 * pauta o marcar un hito (que invalidan esa raíz) la refresca sola.
 */
export function useMaintenanceBoard() {
  return useQuery({ queryKey: [...MAINTENANCE_PLANS_KEY, 'board'], queryFn: MaintenancePlanAPI.board });
}

export interface SaveMaintenancePlanVars {
  equipmentId: string;
  internalCode: string;
  plan: SaveMaintenancePlanInput;
}

/**
 * Guarda la pauta entera. Va por la cola de escrituras: sin señal queda
 * pendiente y se envía al volver. Es last-write-wins — la pauta se edita como
 * una planilla y se guarda completa.
 */
export function useSaveMaintenancePlan() {
  return useQueuedMutation<'maintenancePlan.save', SaveMaintenancePlanVars>({
    endpoint: 'maintenancePlan.save',
    build: ({ equipmentId, plan }) => ({ params: { equipmentId }, body: plan }),
    onSent: (_data, { internalCode }) => {
      toast.success('Pauta guardada', { description: internalCode });
    },
    errorFallback: 'No se pudo guardar la pauta de mantención.',
  });
}

export interface CorregirUltimoCambioVars extends CorregirUltimoCambioInput {
  equipmentId: string;
  internalCode: string;
}

/**
 * Corrige la fecha y la lectura del último cambio desde la pizarra (solo
 * ADMIN). Va por la cola de escrituras como la pauta; el replay refresca la
 * raíz de las pautas (pizarra y pronóstico). Los 400 del backend (fecha futura,
 * lectura fuera de rango…) llegan tal cual en el toast de error.
 */
export function useCorregirUltimoCambio() {
  return useQueuedMutation<'maintenancePlan.lastChange', CorregirUltimoCambioVars>({
    endpoint: 'maintenancePlan.lastChange',
    build: ({ equipmentId, doneAt, counterAt }) => ({ params: { equipmentId }, body: { doneAt, counterAt } }),
    onSent: (_data, { internalCode }) => {
      toast.success('Último cambio corregido', { description: internalCode });
    },
    errorFallback: 'No se pudo corregir el último cambio.',
  });
}

/** Una vuelta del ciclo de mantenciones del equipo; sin `cycle`, la que corre. */
export function useMaintenanceCycle(equipmentId: string, cycle: number | undefined, enabled = true) {
  return useQuery({
    queryKey: [...MAINTENANCE_PLANS_KEY, equipmentId, 'cycle', cycle ?? 'actual'],
    queryFn: () => MaintenancePlanAPI.cycle(equipmentId, cycle),
    enabled,
  });
}

export interface SetMaintenanceRecordVars extends SetMaintenanceRecordInput {
  equipmentId: string;
}

/**
 * Marca o desmarca una operación como hecha en el ciclo. Va por la cola de
 * escrituras: sin señal queda pendiente y se envía al volver.
 */
export function useSetMaintenanceRecord() {
  return useQueuedMutation<'maintenanceRecord.set', SetMaintenanceRecordVars>({
    endpoint: 'maintenanceRecord.set',
    build: ({ equipmentId, ...body }) => ({ params: { equipmentId }, body }),
    errorFallback: 'No se pudo registrar la mantención.',
  });
}
