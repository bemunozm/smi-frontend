import { describe, it, expect } from 'vitest';

import { cobraMinimo, horasCobrables } from './trabajos-extra';

/** Acta N.° 004, punto 4: mínimo de una hora máquina por trabajo. */
describe('horasCobrables', () => {
  it('cobra una hora aunque la tarea tome minutos', () => {
    expect(horasCobrables(0.2)).toBe(1);
  });

  /** El horómetro marca décimas: una tarea muy corta puede leerse 0,0. */
  it('cobra una hora aunque el horómetro no haya avanzado', () => {
    expect(horasCobrables(0)).toBe(1);
  });

  it('cobra las horas reales cuando pasan del mínimo', () => {
    expect(horasCobrables(2.5)).toBe(2.5);
  });

  it('marca cuándo se está cobrando el mínimo', () => {
    expect(cobraMinimo(0.4)).toBe(true);
    expect(cobraMinimo(1)).toBe(false);
  });
});
