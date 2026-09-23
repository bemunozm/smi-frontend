import { describe, expect, it } from 'vitest';

import { EquipmentFormSchema, toEquipmentPayload, toUpdateEquipmentPayload } from './equipment';


describe('EquipmentFormSchema', () => {
  const valido = {
    internalCode: 'ex-001',
    licensePlate: '',
    equipmentClass: 'HEAVY' as const,
    type: 'Excavadora',
    brand: 'Caterpillar',
    model: '336',
    year: '2019',
    controlUnit: 'HOURS' as const,
    status: 'OPERATIONAL' as const,
    homeBranchId: '',
    photoUrl: null,
  };

  it('acepta el año vacío (es opcional)', () => {
    expect(EquipmentFormSchema.safeParse({ ...valido, year: '' }).success).toBe(true);
  });

  it('rechaza un año que no tenga 4 dígitos', () => {
    expect(EquipmentFormSchema.safeParse({ ...valido, year: '19' }).success).toBe(false);
  });

  it('rechaza un año fuera del rango razonable', () => {
    expect(EquipmentFormSchema.safeParse({ ...valido, year: '1800' }).success).toBe(false);
  });

  it('rechaza el código vacío', () => {
    expect(EquipmentFormSchema.safeParse({ ...valido, internalCode: '' }).success).toBe(false);
  });
});

describe('toEquipmentPayload', () => {
  it('normaliza el código a mayúsculas y sin espacios', () => {
    const payload = toEquipmentPayload({
      internalCode: '  ex-001 ',
      licensePlate: '',
      equipmentClass: 'HEAVY',
      type: ' Excavadora ',
      brand: 'Caterpillar',
      model: '336',
      year: '2019',
      controlUnit: 'HOURS',
      status: 'OPERATIONAL',
      homeBranchId: '',
      photoUrl: null,
    });

    expect(payload.internalCode).toBe('EX-001');
    expect(payload.type).toBe('Excavadora');
    expect(payload.year).toBe(2019);
  });

  it('omite el año, la patente y la sucursal cuando vienen vacíos en vez de mandar null', () => {
    // El DTO del backend los marca `@IsOptional()` y corre con
    // `forbidNonWhitelisted`: un `null` explícito haría fallar la validación.
    const payload = toEquipmentPayload({
      internalCode: 'CM-002',
      licensePlate: '',
      equipmentClass: 'HEAVY',
      type: 'Camión',
      brand: 'Volvo',
      model: 'FMX',
      year: '',
      controlUnit: 'KM',
      status: 'IN_WORKSHOP',
      homeBranchId: '',
      photoUrl: null,
    });

    expect('year' in payload).toBe(false);
    expect('licensePlate' in payload).toBe(false);
    expect('homeBranchId' in payload).toBe(false);
    expect('photoUrl' in payload).toBe(false);
  });
});

describe('toUpdateEquipmentPayload', () => {
  const valido = {
    internalCode: 'ex-001',
    licensePlate: '',
    equipmentClass: 'HEAVY' as const,
    type: 'Excavadora',
    brand: 'Caterpillar',
    model: '336',
    year: '',
    controlUnit: 'HOURS' as const,
    status: 'OPERATIONAL' as const,
    homeBranchId: '',
    photoUrl: null,
  };

  it('manda `null` explícito en patente, año y sucursal cuando vienen vacíos (a diferencia de crear)', () => {
    // Contrato acordado con backend: en UPDATE es la única forma de limpiar un
    // valor ya guardado (los 3 campos son `@IsOptional()` y aceptan `null`).
    const payload = toUpdateEquipmentPayload(valido);

    expect(payload.licensePlate).toBeNull();
    expect(payload.year).toBeNull();
    expect(payload.homeBranchId).toBeNull();
    expect(payload.photoUrl).toBeNull();
    // El código interno no es editable — el builder de update ni lo recibe.
    expect('internalCode' in payload).toBe(false);
  });

  it('normaliza y manda el valor cuando el campo viene informado', () => {
    const payload = toUpdateEquipmentPayload({
      ...valido,
      licensePlate: ' ab-cd-12 ',
      year: '2019',
      homeBranchId: 'branch_1',
      photoUrl: '/uploads/foto.jpg',
    });

    expect(payload.licensePlate).toBe('AB-CD-12');
    expect(payload.year).toBe(2019);
    expect(payload.homeBranchId).toBe('branch_1');
    expect(payload.photoUrl).toBe('/uploads/foto.jpg');
  });
});
