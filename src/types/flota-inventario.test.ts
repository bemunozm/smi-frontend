import { describe, expect, it } from 'vitest';

import { EquipmentFormSchema, toEquipmentPayload, toUpdateEquipmentPayload } from './equipment';
import {
  estaBajoMinimo,
  MovimientoFormSchema,
  toInsumoPayload,
  toMovimientoPayload,
  type Insumo,
} from './inventario';

const INSUMO_BASE: Insumo = {
  id: 'ins_1',
  codigo: 'ACE-001',
  nombre: 'Aceite motor 15W-40',
  descripcion: null,
  unidad: 'LITRO',
  stock: 100,
  stockMinimo: 50,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

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
    });

    expect('year' in payload).toBe(false);
    expect('licensePlate' in payload).toBe(false);
    expect('homeBranchId' in payload).toBe(false);
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
  };

  it('manda `null` explícito en patente, año y sucursal cuando vienen vacíos (a diferencia de crear)', () => {
    // Contrato acordado con backend: en UPDATE es la única forma de limpiar un
    // valor ya guardado (los 3 campos son `@IsOptional()` y aceptan `null`).
    const payload = toUpdateEquipmentPayload(valido);

    expect(payload.licensePlate).toBeNull();
    expect(payload.year).toBeNull();
    expect(payload.homeBranchId).toBeNull();
    // El código interno no es editable — el builder de update ni lo recibe.
    expect('internalCode' in payload).toBe(false);
  });

  it('normaliza y manda el valor cuando el campo viene informado', () => {
    const payload = toUpdateEquipmentPayload({
      ...valido,
      licensePlate: ' ab-cd-12 ',
      year: '2019',
      homeBranchId: 'branch_1',
    });

    expect(payload.licensePlate).toBe('AB-CD-12');
    expect(payload.year).toBe(2019);
    expect(payload.homeBranchId).toBe('branch_1');
  });
});

describe('toInsumoPayload', () => {
  it('convierte los campos numéricos de string a número', () => {
    const payload = toInsumoPayload({
      codigo: 'fil-001',
      nombre: ' Filtro de aceite ',
      descripcion: '',
      unidad: 'UNIDAD',
      stock: '40',
      stockMinimo: '10',
    });

    expect(payload).toMatchObject({
      codigo: 'FIL-001',
      nombre: 'Filtro de aceite',
      stock: 40,
      stockMinimo: 10,
    });
    expect('descripcion' in payload).toBe(false);
  });
});

describe('MovimientoFormSchema', () => {
  const valido = {
    insumoId: 'ins_1',
    tipo: 'SALIDA' as const,
    origen: 'INTERVENCION' as const,
    cantidad: '10',
    equipoId: '',
    observacion: '',
  };

  it('rechaza una cantidad de 0', () => {
    expect(MovimientoFormSchema.safeParse({ ...valido, cantidad: '0' }).success).toBe(false);
  });

  it('rechaza una cantidad no numérica', () => {
    expect(MovimientoFormSchema.safeParse({ ...valido, cantidad: 'diez' }).success).toBe(false);
  });

  it('exige elegir un insumo', () => {
    expect(MovimientoFormSchema.safeParse({ ...valido, insumoId: '' }).success).toBe(false);
  });
});

describe('toMovimientoPayload', () => {
  it('omite equipoId y observación cuando vienen vacíos', () => {
    const payload = toMovimientoPayload({
      insumoId: 'ins_1',
      tipo: 'SALIDA',
      origen: 'INTERVENCION',
      cantidad: '12.5',
      equipoId: '',
      observacion: '   ',
    });

    expect(payload).toEqual({
      insumoId: 'ins_1',
      tipo: 'SALIDA',
      origen: 'INTERVENCION',
      cantidad: 12.5,
    });
  });

  it('incluye equipoId cuando se selecciona una unidad', () => {
    const payload = toMovimientoPayload({
      insumoId: 'ins_1',
      tipo: 'SALIDA',
      origen: 'INTERVENCION',
      cantidad: '5',
      equipoId: 'eq_1',
      observacion: 'Cambio de aceite',
    });

    expect(payload.equipoId).toBe('eq_1');
    expect(payload.observacion).toBe('Cambio de aceite');
  });
});

describe('estaBajoMinimo', () => {
  it('marca bajo mínimo cuando el stock es menor al mínimo', () => {
    expect(estaBajoMinimo({ ...INSUMO_BASE, stock: 49 })).toBe(true);
  });

  it('marca bajo mínimo también al tocar exactamente el mínimo', () => {
    // Mismo criterio que el backend (`stock <= stockMinimo`): estar justo en el
    // mínimo ya es motivo de alerta, no un caso "todavía OK".
    expect(estaBajoMinimo({ ...INSUMO_BASE, stock: 50 })).toBe(true);
  });

  it('no marca nada cuando hay stock de sobra', () => {
    expect(estaBajoMinimo(INSUMO_BASE)).toBe(false);
  });
});
