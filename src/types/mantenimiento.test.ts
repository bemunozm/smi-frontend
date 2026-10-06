import { describe, expect, it } from 'vitest';

import { CreateIntervencionSchema, toCreateOrdenInput } from './mantenimiento';

describe('CreateIntervencionSchema (cierre de tarea)', () => {
  const BASE = { tipo: 'PREVENTIVA' as const, detalle: 'Cambio de filtro', horasHombre: 1 };

  it('con insumos exige la bodega (el descuento sale de UNA bodega)', () => {
    const sinBodega = CreateIntervencionSchema.safeParse({
      ...BASE,
      insumos: [{ insumoId: 'item-1', cantidad: 1 }],
    });
    expect(sinBodega.success).toBe(false);
    if (!sinBodega.success) {
      expect(sinBodega.error.issues.some((issue) => issue.path.includes('branchId'))).toBe(true);
    }

    const conBodega = CreateIntervencionSchema.safeParse({
      ...BASE,
      branchId: 'branch-1',
      insumos: [{ insumoId: 'item-1', cantidad: 1 }],
    });
    expect(conBodega.success).toBe(true);
  });

  it('sin insumos no exige bodega', () => {
    expect(CreateIntervencionSchema.safeParse(BASE).success).toBe(true);
  });
});

describe('toCreateOrdenInput (form "Nueva operación" de la Bitácora)', () => {
  it('correctiva con hallazgo → origen HALLAZGO con el detalle', () => {
    const input = toCreateOrdenInput({
      equipoId: 'EX-014',
      tipo: 'CORRECTIVA',
      hallazgo: 'Fuga de aceite hidráulico en pluma',
      titulo: 'Reparación de fuga hidráulica',
    });
    expect(input).toEqual({
      equipoId: 'EX-014',
      titulo: 'Reparación de fuga hidráulica',
      prioridad: 'MEDIA',
      tipo: 'CORRECTIVA',
      origen: 'HALLAZGO',
      origenDetalle: 'Fuga de aceite hidráulico en pluma',
    });
  });

  it('correctiva sin hallazgo → origen MANUAL, sin origenDetalle', () => {
    const input = toCreateOrdenInput({
      equipoId: 'EX-014',
      tipo: 'CORRECTIVA',
      hallazgo: '   ',
      titulo: 'Ajuste de frenos',
    });
    expect(input.origen).toBe('MANUAL');
    expect(input).not.toHaveProperty('origenDetalle');
  });

  it('preventiva → origen PREVENTIVO e ignora el hallazgo', () => {
    const input = toCreateOrdenInput({
      equipoId: 'CM-007',
      tipo: 'PREVENTIVA',
      hallazgo: 'esto no aplica',
      titulo: 'Cambio de aceite 250 h',
    });
    expect(input.origen).toBe('PREVENTIVO');
    expect(input).not.toHaveProperty('origenDetalle');
  });
});
