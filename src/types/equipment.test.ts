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
    technicalInspectionExpiry: '',
    insuranceExpiry: '',
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

  // R1/R2: vencimiento de revisión técnica/seguro — opcionales (se puede
  // guardar el equipo sin fecha cargada, mismo criterio que `licensePlate`).
  it('acepta los vencimientos de revisión técnica y seguro vacíos (son opcionales)', () => {
    expect(
      EquipmentFormSchema.safeParse({ ...valido, technicalInspectionExpiry: '', insuranceExpiry: '' }).success,
    ).toBe(true);
  });

  it('acepta una fecha de vencimiento bien formada (`YYYY-MM-DD`, formato de `<Input type="date">`)', () => {
    expect(
      EquipmentFormSchema.safeParse({
        ...valido,
        technicalInspectionExpiry: '2026-12-01',
        insuranceExpiry: '2027-01-15',
      }).success,
    ).toBe(true);
  });

  it('rechaza una fecha de vencimiento mal formada', () => {
    expect(EquipmentFormSchema.safeParse({ ...valido, technicalInspectionExpiry: '01/12/2026' }).success).toBe(
      false,
    );
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
      technicalInspectionExpiry: '',
      insuranceExpiry: '',
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
      technicalInspectionExpiry: '',
      insuranceExpiry: '',
    });

    expect('year' in payload).toBe(false);
    expect('licensePlate' in payload).toBe(false);
    expect('homeBranchId' in payload).toBe(false);
    expect('photoUrl' in payload).toBe(false);
    expect('technicalInspectionExpiry' in payload).toBe(false);
    expect('insuranceExpiry' in payload).toBe(false);
  });

  // R1/R2: mismo criterio que el resto de los campos opcionales de crear —
  // solo se manda la clave cuando el usuario cargó una fecha.
  it('manda los vencimientos de revisión técnica y seguro cuando vienen informados', () => {
    const payload = toEquipmentPayload({
      internalCode: 'CM-003',
      licensePlate: '',
      equipmentClass: 'HEAVY',
      type: 'Camión',
      brand: 'Volvo',
      model: 'FMX',
      year: '',
      controlUnit: 'KM',
      status: 'OPERATIONAL',
      homeBranchId: '',
      photoUrl: null,
      technicalInspectionExpiry: '2026-12-01',
      insuranceExpiry: '2027-01-15',
    });

    expect(payload.technicalInspectionExpiry).toBe('2026-12-01');
    expect(payload.insuranceExpiry).toBe('2027-01-15');
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
    technicalInspectionExpiry: '',
    insuranceExpiry: '',
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

  // R1/R2: mismo contrato "vacío → null explícito" que patente/año/sucursal —
  // es la única forma de LIMPIAR una fecha ya guardada (§ requerimiento "permite
  // limpiarlas").
  it('manda `null` explícito en los vencimientos de revisión técnica y seguro cuando vienen vacíos', () => {
    const payload = toUpdateEquipmentPayload(valido);

    expect(payload.technicalInspectionExpiry).toBeNull();
    expect(payload.insuranceExpiry).toBeNull();
  });

  it('manda el vencimiento informado tal cual (ya viene en formato `YYYY-MM-DD`)', () => {
    const payload = toUpdateEquipmentPayload({
      ...valido,
      technicalInspectionExpiry: '2026-12-01',
      insuranceExpiry: '2027-01-15',
    });

    expect(payload.technicalInspectionExpiry).toBe('2026-12-01');
    expect(payload.insuranceExpiry).toBe('2027-01-15');
  });
});
