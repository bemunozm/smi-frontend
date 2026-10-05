import { describe, expect, it } from 'vitest';

import { formatDecimalInput, parseDecimal } from './decimal';

describe('parseDecimal', () => {
  it.each([
    ['12.5', 12.5],
    ['12,5', 12.5],
    ['2112.5', 2112.5],
    ['2112,5', 2112.5],
    ['1.234,5', 1234.5],
    ['1,234.5', 1234.5],
    ['12', 12],
    ['0,5', 0.5],
    ['.5', 0.5],
    ['12.', 12],
    ['-3,5', -3.5],
    ['  7,25  ', 7.25],
  ])('lee %j como %d', (texto, esperado) => {
    expect(parseDecimal(texto)).toBe(esperado);
  });

  it('un punto suelto NO es separador de miles', () => {
    expect(parseDecimal('12.5')).not.toBe(125);
    expect(parseDecimal('2112.5')).not.toBe(21125);
  });

  it.each(['abc', '', '   ', '12abc', 'a12', '-', '.', ',', '1.234.567', '1,234,567', '1,2,3.4', '1..2', '--5', '1 2'])(
    'devuelve null para %j',
    (texto) => {
      expect(parseDecimal(texto)).toBeNull();
    },
  );
});

describe('formatDecimalInput', () => {
  it('escribe coma decimal y sin separador de miles', () => {
    expect(formatDecimalInput(12.5)).toBe('12,5');
    expect(formatDecimalInput(2112.5)).toBe('2112,5');
    expect(formatDecimalInput(12487)).toBe('12487');
  });

  it('vacío para lo que no es un número', () => {
    expect(formatDecimalInput(null)).toBe('');
    expect(formatDecimalInput(undefined)).toBe('');
    expect(formatDecimalInput(Number.NaN)).toBe('');
  });

  it('respeta el máximo de decimales', () => {
    expect(formatDecimalInput(1.23456, 2)).toBe('1,23');
    expect(formatDecimalInput(1.5, 0)).toBe('2');
  });

  it('lo que escribe vuelve igual por parseDecimal', () => {
    for (const valor of [0, 12.5, 2112.5, 19020.25, 1234567.5]) {
      expect(parseDecimal(formatDecimalInput(valor))).toBe(valor);
    }
  });
});
