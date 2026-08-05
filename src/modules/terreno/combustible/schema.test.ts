import { describe, it, expect } from 'vitest';
import { combustibleFormSchema } from './schema';

describe('combustibleFormSchema', () => {
  it('acepta litros + tipo', () => {
    expect(combustibleFormSchema.safeParse({ equipoId: 'e1', litros: 50, tipo: 'PETROLEO' }).success).toBe(true);
  });

  it('rechaza litros <= 0', () => {
    expect(combustibleFormSchema.safeParse({ equipoId: 'e1', litros: 0, tipo: 'PETROLEO' }).success).toBe(false);
  });

  it('rechaza tipo inválido', () => {
    expect(combustibleFormSchema.safeParse({ equipoId: 'e1', litros: 50, tipo: 'GAS' }).success).toBe(false);
  });
});
