import { describe, it, expect } from 'vitest';
import { horometroFormSchema } from './horometro';

describe('horometroFormSchema', () => {
  it('acepta un registro válido', () => {
    const r = horometroFormSchema.safeParse({
      equipoId: 'e1', operador: 'Juan Rojas', turno: 'DIURNO', valorInicial: 100,
    });
    expect(r.success).toBe(true);
  });

  it('rechaza turno inválido', () => {
    const r = horometroFormSchema.safeParse({
      equipoId: 'e1', operador: 'Juan Rojas', turno: 'MANANA', valorInicial: 100,
    });
    expect(r.success).toBe(false);
  });
});
