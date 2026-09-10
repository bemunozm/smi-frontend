import { describe, expect, it } from 'vitest';

import { StockListResponseSchema, type StockEnSucursal } from './stock';
import { sucursalPorDefecto, type Sucursal } from './sucursal';

const BASE: StockEnSucursal = {
  insumoId: 'ins_1',
  codigo: 'NEU-001',
  nombre: 'Neumático 29.5R25',
  descripcion: null,
  unidad: 'UNIDAD',
  tipo: 'REPUESTO',
  stock: 4,
  stockTotal: 4,
  stockMinimo: 2,
  enBodega: true,
  bajoMinimo: false,
};

function sucursal(over: Partial<Sucursal>): Sucursal {
  return {
    id: 'suc_1',
    codigo: 'CENTRAL',
    nombre: 'Casa Matriz',
    direccion: null,
    activa: true,
    esPrincipal: false,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...over,
  };
}

describe('StockListResponseSchema', () => {
  it('valida la envoltura { data, message } del backend', () => {
    const parsed = StockListResponseSchema.parse({
      data: { sucursalId: 'suc_1', items: [BASE] },
      message: 'ok',
    });
    expect(parsed.data.items[0].codigo).toBe('NEU-001');
  });

  it('rechaza un tipo de insumo fuera del vocabulario', () => {
    const result = StockListResponseSchema.safeParse({
      data: { sucursalId: 'suc_1', items: [{ ...BASE, tipo: 'OTRO' }] },
      message: 'ok',
    });
    expect(result.success).toBe(false);
  });
});

describe('sucursalPorDefecto', () => {
  it('elige la principal aunque no sea la primera de la lista', () => {
    const elegida = sucursalPorDefecto([
      sucursal({ id: 'suc_2', codigo: 'NORTE' }),
      sucursal({ id: 'suc_1', esPrincipal: true }),
    ]);
    expect(elegida?.id).toBe('suc_1');
  });

  it('cae a la primera si ninguna está marcada', () => {
    const elegida = sucursalPorDefecto([sucursal({ id: 'suc_2' })]);
    expect(elegida?.id).toBe('suc_2');
  });

  it('devuelve undefined con la lista vacía, sin reventar', () => {
    expect(sucursalPorDefecto([])).toBeUndefined();
  });
});
