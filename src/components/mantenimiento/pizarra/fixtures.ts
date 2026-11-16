import type { MaintenanceBoardRow } from '../../../types/maintenance-board';

/** Fila de la pizarra para tests: un pesado con pauta y último cambio registrado. */
export function filaPizarra(over: Partial<MaintenanceBoardRow> = {}): MaintenanceBoardRow {
  return {
    equipmentId: 'e1',
    internalCode: 'SEM 02',
    type: 'Cargador frontal',
    brand: 'SEM',
    model: '656F',
    equipmentClass: 'HEAVY',
    unit: 'h',
    status: 'OPERATIONAL',
    counter: 2400,
    source: 'PAUTA',
    milestones: [250, 500, 750, 1000],
    initialMilestone: null,
    lastChange: { milestone: 250, counterAt: 2250, doneAt: '2026-10-01T12:00:00.000Z' },
    interval: 250,
    nextMilestone: 500,
    dueAt: 2500,
    remaining: 100,
    alertBefore: 50,
    estimated: false,
    items: [],
    ...over,
  };
}
