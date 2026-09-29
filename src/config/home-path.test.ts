import { describe, expect, it } from 'vitest';

import { homePathFor } from './home-path';
import { ROLES } from '../types/roles';

describe('homePathFor', () => {
  it('manda a SUPERVISOR directo a Registro de equipo', () => {
    expect(homePathFor(ROLES.SUPERVISOR)).toBe('/terreno/registro');
  });

  it('manda a ADMIN y MANTENEDOR al dashboard', () => {
    expect(homePathFor(ROLES.ADMIN)).toBe('/');
    expect(homePathFor(ROLES.MANTENEDOR)).toBe('/');
  });

  // `null` cubre tanto "sesión sin rol" como un rol que YA NO EXISTE
  // (`isRole()` angosta cualquier valor desconocido, incluido un snapshot
  // viejo con `role: 'OPERADOR'`, a `null` antes de que llegue acá). Cae a
  // `/`, igual
  // que ADMIN/MANTENEDOR — `ProtectedRoute` lo termina de filtrar con su
  // `allowedRoles`, así que nunca queda dando vueltas: aterriza en
  // `/forbidden` en UN solo salto, nunca en loop (ver la prueba de
  // integración en `HomeRedirect.test.tsx`).
  it('un rol nulo (desconocido, o un rol que ya no existe) cae al dashboard, igual que ADMIN/MANTENEDOR', () => {
    expect(homePathFor(null)).toBe('/');
  });
});
