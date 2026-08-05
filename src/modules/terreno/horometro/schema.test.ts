import { describe, it, expect } from 'vitest';
import { horometroFormSchema } from './schema';

describe('horometroFormSchema', () => {
  it('acepta un registro válido', () => {
    const r = horometroFormSchema.safeParse({
      equipoId: 'e1', operadorId: 'op1', turno: 'MANANA', valorInicial: 100,
    });
    expect(r.success).toBe(true);
  });

  it('rechaza turno inválido', () => {
    const r = horometroFormSchema.safeParse({
      equipoId: 'e1', operadorId: 'op1', turno: 'MADRUGADA', valorInicial: 100,
    });
    expect(r.success).toBe(false);
  });
});
