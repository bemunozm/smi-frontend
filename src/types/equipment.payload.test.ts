import { describe, expect, it } from 'vitest';

import { toEquipmentPayload, toUpdateEquipmentPayload, type EquipmentFormValues } from './equipment';

const BASE: EquipmentFormValues = {
  internalCode: 'ex-001',
  licensePlate: '',
  equipmentClass: 'HEAVY',
  type: 'Excavadora',
  brand: 'Caterpillar',
  model: '336',
  year: '',
  controlUnit: 'HOURS',
  status: 'OPERATIONAL',
  homeBranchId: '',
  lecturaActual: '',
};

describe('lectura del equipo en los payloads', () => {
  it('crear con unidad en horas manda currentHourmeter, nunca currentMileage', () => {
    const payload = toEquipmentPayload({ ...BASE, lecturaActual: '2100' });

    expect(payload.currentHourmeter).toBe(2100);
    expect('currentMileage' in payload).toBe(false);
  });

  it('crear con unidad en km manda currentMileage', () => {
    const payload = toEquipmentPayload({ ...BASE, controlUnit: 'KM', lecturaActual: '54300' });

    expect(payload.currentMileage).toBe(54300);
    expect('currentHourmeter' in payload).toBe(false);
  });

  it('sin lectura, la clave se omite en crear y en editar (editar no la borra)', () => {
    expect('currentHourmeter' in toEquipmentPayload(BASE)).toBe(false);
    expect('currentHourmeter' in toUpdateEquipmentPayload(BASE)).toBe(false);
    expect('currentMileage' in toUpdateEquipmentPayload({ ...BASE, controlUnit: 'KM' })).toBe(false);
  });

  it('editar manda la lectura según la unidad, con coma decimal tolerada', () => {
    const payload = toUpdateEquipmentPayload({ ...BASE, lecturaActual: '2100,5' });

    expect(payload.currentHourmeter).toBe(2100.5);
  });
});
