import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { leerNumero, NUMERO_INVALIDO, nonNegNumber, optNumber, posNumber } from './forms';

describe('leerNumero', () => {
  // Un punto o una coma sueltos son el decimal; sin separador, el número es entero.
  it.each([
    ['12.5', 12.5],
    ['12,5', 12.5],
    ['100.000', 100],
    ['100000', 100000],
    [' 7 ', 7],
    [42, 42],
  ])('lee %j como %d', (valor, esperado) => {
    expect(leerNumero(valor)).toBe(esperado);
  });

  it('deja vacío como undefined (incluido el NaN de un input nativo vacío)', () => {
    expect(leerNumero('')).toBeUndefined();
    expect(leerNumero('   ')).toBeUndefined();
    expect(leerNumero(Number.NaN)).toBeUndefined();
  });

  it('deja como NaN lo que no se puede leer', () => {
    expect(leerNumero('abc')).toBeNaN();
    expect(leerNumero('1.234.567')).toBeNaN();
  });
});

const mensaje = (schema: z.ZodType, valor: unknown) => {
  const r = schema.safeParse(valor);
  return r.success ? null : r.error.issues[0]?.message;
};

describe('helpers numéricos', () => {
  it('posNumber y nonNegNumber leen texto con punto o coma', () => {
    expect(posNumber().parse('3,5')).toBe(3.5);
    expect(nonNegNumber().parse('0')).toBe(0);
    expect(optNumber.parse('1.25')).toBe(1.25);
    expect(optNumber.parse('')).toBeUndefined();
  });

  it('dice «Requerido» si está vacío y cómo escribirlo si no es número', () => {
    expect(mensaje(posNumber(), '')).toBe('Requerido');
    expect(mensaje(posNumber(), 'abc')).toBe(NUMERO_INVALIDO);
    expect(mensaje(nonNegNumber(), '1.2.3')).toBe(NUMERO_INVALIDO);
    expect(mensaje(optNumber, 'x')).toBe(NUMERO_INVALIDO);
  });
});
