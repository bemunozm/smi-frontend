import { describe, it, expect } from 'vitest';

import { cobraMinimo, horasCobrables, pistaFolio, textoPistaFolio } from './trabajos-extra';

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

/** Folio del report en papel: se sugiere el siguiente de la secuencia (pedido del 05/11). */
describe('pistaFolio', () => {
  const registros = [
    { id: 'a', reportNumero: '4507' },
    { id: 'b', reportNumero: '4508' },
    // Un report olvidado, cargado después: folio viejo, no mueve la secuencia.
    { id: 'c', reportNumero: '4490' },
    { id: 'd', reportNumero: null },
    { id: 'e', reportNumero: 'S/N' },
  ];

  it('el último es el folio más alto, no el último cargado, y sugiere el siguiente', () => {
    const pista = pistaFolio(registros, '');
    expect(pista).toEqual({ ultimo: '4508', siguiente: '4509', repetido: false });
    expect(textoPistaFolio(pista)).toBe('Último report registrado: 4508 · el siguiente sería 4509.');
  });

  it('avisa un folio repetido, salvo el del Report que se está corrigiendo', () => {
    expect(pistaFolio(registros, ' 4508 ').repetido).toBe(true);
    expect(pistaFolio(registros, '4508', 'b').repetido).toBe(false);
    expect(pistaFolio(registros, '4509').repetido).toBe(false);
  });

  it('respeta los ceros a la izquierda y no inventa nada sin folios', () => {
    expect(pistaFolio([{ id: 'a', reportNumero: '0099' }], '').siguiente).toBe('0100');
    expect(pistaFolio([], '')).toEqual({ ultimo: null, siguiente: null, repetido: false });
    expect(textoPistaFolio(pistaFolio([], ''))).toBeNull();
  });
});
