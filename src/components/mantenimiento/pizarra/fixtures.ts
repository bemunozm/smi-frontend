import type { MaintenanceBoardRow } from '../../../types/maintenance-board';

type UltimoCambio = NonNullable<MaintenanceBoardRow['lastChange']>;

/** Último cambio para tests: una mantención anterior (con orden) de 250 h. */
export function ultimoCambio(over: Partial<UltimoCambio> = {}): UltimoCambio {
  return {
    milestone: 250,
    counterAt: 2250,
    doneAt: '2026-10-01T12:00:00.000Z',
    ordenId: 'ot1',
    tipo: 'PREVENTIVA',
    titulo: 'Mantención 250 h',
    realizadaPor: 'Taller Norte',
    observaciones: 'Sin novedad',
    historica: true,
    ...over,
  };
}

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
    lastChange: ultimoCambio(),
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
