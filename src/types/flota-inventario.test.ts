import { describe, expect, it } from 'vitest';

import { EquipoFormSchema, toEquipoPayload } from './equipo';
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

describe('EquipoFormSchema', () => {
  const valido = {
    codigo: 'ex-001',
    tipo: 'Excavadora',
    marca: 'Caterpillar',
    modelo: '336',
    anio: '2019',
    estado: 'DISPONIBLE' as const,
  };

  it('acepta el año vacío (es opcional)', () => {
    expect(EquipoFormSchema.safeParse({ ...valido, anio: '' }).success).toBe(true);
  });

  it('rechaza un año que no tenga 4 dígitos', () => {
    expect(EquipoFormSchema.safeParse({ ...valido, anio: '19' }).success).toBe(false);
  });

  it('rechaza un año fuera del rango razonable', () => {
    expect(EquipoFormSchema.safeParse({ ...valido, anio: '1800' }).success).toBe(false);
  });

  it('rechaza el código vacío', () => {
    expect(EquipoFormSchema.safeParse({ ...valido, codigo: '' }).success).toBe(false);
  });
});

describe('toEquipoPayload', () => {
  it('normaliza el código a mayúsculas y sin espacios', () => {
    const payload = toEquipoPayload({
      codigo: '  ex-001 ',
      tipo: ' Excavadora ',
      marca: 'Caterpillar',
      modelo: '336',
      anio: '2019',
      estado: 'DISPONIBLE',
    });

    expect(payload.codigo).toBe('EX-001');
    expect(payload.tipo).toBe('Excavadora');
    expect(payload.anio).toBe(2019);
  });

  it('omite el año cuando viene vacío en vez de mandar null', () => {
    // El DTO del backend lo marca `@IsOptional()` y corre con
    // `forbidNonWhitelisted`: un `null` explícito haría fallar la validación.
    const payload = toEquipoPayload({
      codigo: 'CM-002',
      tipo: 'Camión',
      marca: 'Volvo',
      modelo: 'FMX',
      anio: '',
      estado: 'EN_RUTA',
    });

    expect('anio' in payload).toBe(false);
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
