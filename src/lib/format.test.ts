import { describe, expect, it } from 'vitest';

import { fmtDecimales, plural } from './format';

describe('plural', () => {
  it('singular con n=1', () => {
    expect(plural(1, 'equipo', 'equipos')).toBe('1 equipo');
  });

  it('plural con n=0 y n>1', () => {
    expect(plural(0, 'equipo', 'equipos')).toBe('0 equipos');
    expect(plural(2, 'equipo', 'equipos')).toBe('2 equipos');
  });
});

describe('fmtDecimales', () => {
  it('muestra los decimales que hay, sin redondear al entero ni rellenar con ceros', () => {
    expect(fmtDecimales(12.5, 2)).toBe('12,5');
    expect(fmtDecimales(164, 2)).toBe('164');
    expect(fmtDecimales(164.256, 2)).toBe('164,26');
  });
});
