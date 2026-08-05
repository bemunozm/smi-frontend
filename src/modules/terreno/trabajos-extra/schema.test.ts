import { describe, it, expect } from 'vitest';
import { trabajoExtraFormSchema, calcMonto } from './schema';

describe('trabajoExtraFormSchema', () => {
  it('rechaza horasMaquina <= 0', () => {
    const r = trabajoExtraFormSchema.safeParse({ equipoId: 'e1', cliente: 'X', horasMaquina: 0, tarifa: 100 });
    expect(r.success).toBe(false);
  });
});

describe('calcMonto', () => {
  it('multiplica horas por tarifa', () => {
    expect(calcMonto(12, 85000)).toBe(1020000);
  });
});
