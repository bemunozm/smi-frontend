import { describe, expect, it } from 'vitest';

import { router } from './routes';
import { ROLES } from './types/roles';

type Rt = { path?: string; element?: { props?: { allowedRoles?: unknown } }; children?: Rt[] };

function findGuardOf(routes: Rt[], path: string, guard?: Rt): Rt | undefined {
  for (const r of routes) {
    const g = r.element?.props?.allowedRoles ? r : guard;
    if (r.path === path) return g;
    const hit = r.children ? findGuardOf(r.children, path, g) : undefined;
    if (hit) return hit;
  }
  return undefined;
}

describe('routes', () => {
  it('`/` (dashboard) es de ADMIN y SECRETARIA', () => {
    const guard = findGuardOf(router.routes as unknown as Rt[], '/');
    expect(guard?.element?.props?.allowedRoles).toEqual([ROLES.ADMIN, ROLES.SECRETARIA]);
  });

  it('SECRETARIA entra a hallazgos, trabajos extra y reportes diarios del panel, no a usuarios', () => {
    for (const path of [
      '/hallazgos',
      '/trabajos-extra',
      '/reportes-diarios',
      '/reportes-diarios/cargar',
      '/mantenciones',
      '/reportes',
    ]) {
      const guard = findGuardOf(router.routes as unknown as Rt[], path);
      expect(guard?.element?.props?.allowedRoles).toEqual([ROLES.ADMIN, ROLES.SECRETARIA]);
    }
    const usuarios = findGuardOf(router.routes as unknown as Rt[], '/usuarios');
    expect(usuarios?.element?.props?.allowedRoles).toEqual([ROLES.ADMIN]);
  });
});
