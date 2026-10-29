import { describe, expect, it } from 'vitest';

import { formatRutInput, isValidRut, normalizeRut } from './rut';

// Mismos casos verificados que `smi-backend/src/operators/rut.spec.ts` — este
// archivo es un espejo byte-a-byte de esa validación (ver `lib/rut.ts`), así
// que reusa sus fixtures en vez de calcular dígitos verificadores a mano.
describe('isValidRut', () => {
  it('acepta un RUT con dígito verificador correcto', () => {
    expect(isValidRut('12345678-5')).toBe(true);
    expect(isValidRut('11111111-1')).toBe(true);
  });

  it('acepta un dígito verificador K (mayúscula o minúscula)', () => {
    expect(isValidRut('40000000-K')).toBe(true);
    expect(isValidRut('40000000-k')).toBe(true);
  });

  it('tolera puntos y espacios', () => {
    expect(isValidRut('12.345.678-5')).toBe(true);
    expect(isValidRut('12345678 5')).toBe(true);
    expect(isValidRut(' 12345678-5 ')).toBe(true);
  });

  it('rechaza un dígito verificador incorrecto', () => {
    expect(isValidRut('12345678-9')).toBe(false);
    expect(isValidRut('12345678-K')).toBe(false);
  });

  it('rechaza un cuerpo no numérico', () => {
    expect(isValidRut('ABCDEFGH-5')).toBe(false);
  });

  it('rechaza un cuerpo fuera de 7-8 dígitos', () => {
    expect(isValidRut('123456-4')).toBe(false); // 6 dígitos
    expect(isValidRut('123456789-6')).toBe(false); // 9 dígitos
  });

  it('rechaza un string vacío', () => {
    expect(isValidRut('')).toBe(false);
  });
});

describe('normalizeRut', () => {
  it('normaliza al formato canónico "12345678-K"', () => {
    expect(normalizeRut('12.345.678-5')).toBe('12345678-5');
    expect(normalizeRut('40000000-k')).toBe('40000000-K');
    expect(normalizeRut('11111111-1')).toBe('11111111-1');
  });

  it('devuelve null si el RUT no es válido (a diferencia del backend, que lanza)', () => {
    expect(normalizeRut('12345678-9')).toBeNull();
    expect(normalizeRut('')).toBeNull();
  });
});

describe('formatRutInput (mientras se escribe)', () => {
  it('pone el guion y los puntos solos: se escriben solo los números', () => {
    expect(formatRutInput('1')).toBe('1');
    expect(formatRutInput('12')).toBe('1-2');
    expect(formatRutInput('1234')).toBe('123-4');
    expect(formatRutInput('12345')).toBe('1.234-5');
    expect(formatRutInput('123456789')).toBe('12.345.678-9');
  });

  it('la K solo vale al final, en mayúscula', () => {
    expect(formatRutInput('2222222k')).toBe('2.222.222-K');
    expect(formatRutInput('12k34')).toBe('123-4');
  });

  it('reescribe lo pegado con otro formato y corta en 9 caracteres', () => {
    expect(formatRutInput('12.345.678-9')).toBe('12.345.678-9');
    expect(formatRutInput('12345678-5')).toBe('12.345.678-5');
    expect(formatRutInput('1234567890')).toBe('12.345.678-9');
  });

  it('lo formateado sigue siendo válido para la validación y el backend', () => {
    expect(isValidRut(formatRutInput('111111111'))).toBe(true);
    expect(normalizeRut(formatRutInput('111111111'))).toBe('11111111-1');
  });
});
