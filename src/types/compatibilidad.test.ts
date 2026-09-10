import { describe, expect, it } from 'vitest';

import {
  RepuestosDeEquipoResponseSchema,
  toCompatibilidadPayload,
  type RepuestoCompatible,
} from './compatibilidad';

const BASE: RepuestoCompatible = {
  compatibilidadId: 'comp_1',
  insumoId: 'ins_1',
  codigo: 'NEU-001',
  nombre: 'Neumático 29.5R25',
  descripcion: null,
  unidad: 'UNIDAD',
  tipo: 'REPUESTO',
  nota: null,
  stockSucursal: 4,
  stockTotal: 6,
  stockMinimo: 2,
  bajoMinimo: false,
};

describe('toCompatibilidadPayload', () => {
  it('omite la nota cuando viene vacía o en blanco', () => {
    const payload = toCompatibilidadPayload('eq_1', {
      insumoId: 'ins_1',
      nota: '   ',
    });
    expect(payload).toEqual({ equipoId: 'eq_1', insumoId: 'ins_1' });
  });

  it('recorta la nota cuando trae contenido', () => {
    const payload = toCompatibilidadPayload('eq_1', {
      insumoId: 'ins_1',
      nota: '  Solo eje trasero  ',
    });
    expect(payload).toEqual({
      equipoId: 'eq_1',
      insumoId: 'ins_1',
      nota: 'Solo eje trasero',
    });
  });
});

describe('RepuestosDeEquipoResponseSchema', () => {
  it('valida la envoltura { data, message } del backend', () => {
    const parsed = RepuestosDeEquipoResponseSchema.parse({
      data: {
        equipo: {
          id: 'eq_1',
          codigo: 'EX-001',
          tipo: 'Excavadora',
          marca: 'Caterpillar',
          modelo: '336',
          estado: 'DISPONIBLE',
        },
        sucursalId: 'suc_1',
        repuestos: [BASE],
      },
      message: 'ok',
    });
    expect(parsed.data.repuestos[0].codigo).toBe('NEU-001');
  });

  it('rechaza un estado de equipo fuera del vocabulario', () => {
    const result = RepuestosDeEquipoResponseSchema.safeParse({
      data: {
        equipo: {
          id: 'eq_1',
          codigo: 'EX-001',
          tipo: 'Excavadora',
          marca: 'Caterpillar',
          modelo: '336',
          estado: 'OPERATIVO',
        },
        sucursalId: 'suc_1',
        repuestos: [],
      },
      message: 'ok',
    });
    expect(result.success).toBe(false);
  });
});
