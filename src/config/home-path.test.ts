import { describe, expect, it } from 'vitest';

import { OPERATOR_HOME_PATH, homePathFor } from './home-path';
import { ROLES } from '../types/roles';

describe('homePathFor', () => {
  it('manda a SUPERVISOR directo a Registro de equipo', () => {
    expect(homePathFor(ROLES.SUPERVISOR)).toBe('/terreno/registro');
  });

  it('manda a ADMIN y MANTENEDOR al dashboard', () => {
    expect(homePathFor(ROLES.ADMIN)).toBe('/');
    expect(homePathFor(ROLES.MANTENEDOR)).toBe('/');
  });

  it('manda a OPERADOR a la pantalla "sin módulos", no al dashboard', () => {
    expect(homePathFor(ROLES.OPERADOR)).toBe(OPERATOR_HOME_PATH);
    expect(homePathFor(ROLES.OPERADOR)).toBe('/sin-modulos');
  });

  it('un rol nulo (desconocido) cae al dashboard, igual que ADMIN/MANTENEDOR', () => {
    expect(homePathFor(null)).toBe('/');
  });
});
