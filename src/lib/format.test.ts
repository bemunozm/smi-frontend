import { describe, expect, it } from 'vitest';

import { plural } from './format';

describe('plural', () => {
  it('singular con n=1', () => {
    expect(plural(1, 'equipo', 'equipos')).toBe('1 equipo');
  });

  it('plural con n=0 y n>1', () => {
    expect(plural(0, 'equipo', 'equipos')).toBe('0 equipos');
    expect(plural(2, 'equipo', 'equipos')).toBe('2 equipos');
  });
});
