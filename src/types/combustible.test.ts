import { describe, it, expect } from 'vitest';
import { combustibleFormSchema } from './combustible';

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

  // El campo es texto: un punto o una coma sueltos son el decimal, y sin
  // separador el número es entero.
  it.each([
    ['12.5', 12.5],
    ['12,5', 12.5],
    ['183.089', 183.089],
    ['100000', 100000],
    [' 40 ', 40],
  ])('lee los litros escritos %j como %d', (texto, litros) => {
    const r = combustibleFormSchema.safeParse({ equipoId: 'e1', litros: texto, tipo: 'PETROLEO' });
    expect(r.success && r.data.litros).toBe(litros);
  });

  it.each(['', 'abc', '1.234.567'])('rechaza los litros escritos %j', (texto) => {
    expect(combustibleFormSchema.safeParse({ equipoId: 'e1', litros: texto, tipo: 'PETROLEO' }).success).toBe(false);
  });
});
