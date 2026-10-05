import { describe, expect, it } from 'vitest';

import { adBlueIncompleto, validarAdBlue } from './adblue';

describe('validarAdBlue', () => {
  it('sin AdBlue no hay nada que validar', () => {
    expect(validarAdBlue(false, 99999, true)).toEqual({ litros: null, error: null, aviso: null });
  });

  it('con AdBlue sin litros: no hay error hasta que se toca el campo', () => {
    expect(validarAdBlue(true, null, false).error).toBeNull();
    expect(validarAdBlue(true, null, true).error).toMatch(/litros/);
    expect(validarAdBlue(true, 0, true).error).toMatch(/litros/);
    expect(validarAdBlue(true, -3, true).error).toMatch(/litros/);
  });

  it('sobre 1000 L es un error; 1000 justo es válido', () => {
    expect(validarAdBlue(true, 1000.5, true).error).toMatch(/1000/);
    expect(validarAdBlue(true, 1000, true)).toMatchObject({ litros: 1000, error: null });
  });

  it('hasta 30 L sin aviso; más de 30 L avisa sin error', () => {
    expect(validarAdBlue(true, 30, true)).toEqual({ litros: 30, error: null, aviso: null });
    const grande = validarAdBlue(true, 30.5, true);
    expect(grande.error).toBeNull();
    expect(grande.litros).toBe(30.5);
    expect(grande.aviso).toMatch(/30 L/);
  });
});

describe('adBlueIncompleto', () => {
  it('solo cuenta cuando se marcó AdBlue y los litros no sirven', () => {
    expect(adBlueIncompleto(false, null)).toBe(false);
    expect(adBlueIncompleto(true, null)).toBe(true);
    expect(adBlueIncompleto(true, 0)).toBe(true);
    expect(adBlueIncompleto(true, 1001)).toBe(true);
    expect(adBlueIncompleto(true, 12)).toBe(false);
  });
});
