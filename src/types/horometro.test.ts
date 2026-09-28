import { describe, it, expect } from 'vitest';
import { horometroFormSchema } from './horometro';

describe('horometroFormSchema', () => {
  it('acepta un registro válido', () => {
    const r = horometroFormSchema.safeParse({
      equipoId: 'e1', operatorId: 'op_1', turno: 'DIURNO', valorInicial: 100,
    });
    expect(r.success).toBe(true);
  });

  it('rechaza turno inválido', () => {
    const r = horometroFormSchema.safeParse({
      equipoId: 'e1', operatorId: 'op_1', turno: 'MANANA', valorInicial: 100,
    });
    expect(r.success).toBe(false);
  });

  // El operador ya no es texto libre: el cliente manda solo `operatorId` del
  // catálogo (ver anexo "operador del catálogo en Trabajos extra + snapshot
  // único") — sin él, el backend no tiene forma de validar ni derivar el
  // snapshot `operador`.
  it('rechaza sin operatorId', () => {
    const r = horometroFormSchema.safeParse({
      equipoId: 'e1', turno: 'DIURNO', valorInicial: 100,
    });
    expect(r.success).toBe(false);
  });
});
