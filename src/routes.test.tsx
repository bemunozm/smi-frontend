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

  it('`/camioneta` es solo del PREVENCIONISTA', () => {
    const guard = findGuardOf(router.routes as unknown as Rt[], '/camioneta');
    expect(guard?.element?.props?.allowedRoles).toEqual([ROLES.PREVENCIONISTA]);
  });

  it('`/temporal` es solo del SUPERVISOR_TEMPORAL; `/terreno/registro` no lo admite', () => {
    const temporal = findGuardOf(router.routes as unknown as Rt[], '/temporal');
    expect(temporal?.element?.props?.allowedRoles).toEqual([ROLES.SUPERVISOR_TEMPORAL]);
    const terreno = findGuardOf(router.routes as unknown as Rt[], '/terreno/registro');
    expect(terreno?.element?.props?.allowedRoles).not.toContain(ROLES.SUPERVISOR_TEMPORAL);
  });

  it('«Hallazgos» del supervisor temporal cuelga de su mismo guard; «Mis reportes» ya no es pestaña', () => {
    const guard = findGuardOf(router.routes as unknown as Rt[], '/temporal/hallazgos');
    expect(guard?.element?.props?.allowedRoles).toEqual([ROLES.SUPERVISOR_TEMPORAL]);
    // El historial de reportes vive dentro de «Mis equipos».
    expect(findGuardOf(router.routes as unknown as Rt[], '/temporal/reportes')).toBeUndefined();
  });

  it('SECRETARIA entra a hallazgos, trabajos extra y reportes diarios del panel, no a usuarios', () => {
    for (const path of [
      '/hallazgos',
      '/trabajos-extra',
      '/cargas-combustible',
      '/asistencia',
      '/reportes-diarios',
      '/reportes-diarios/cargar',
      '/mantenciones',
      '/reportes',
      '/chequeos-diarios',
    ]) {
      const guard = findGuardOf(router.routes as unknown as Rt[], path);
      expect(guard?.element?.props?.allowedRoles).toEqual([ROLES.ADMIN, ROLES.SECRETARIA]);
    }
    const usuarios = findGuardOf(router.routes as unknown as Rt[], '/usuarios');
    expect(usuarios?.element?.props?.allowedRoles).toEqual([ROLES.ADMIN]);
  });

  it('SECRETARIA entra a Equipos e Inventario, y a los vencimientos (ADMIN, MANTENEDOR y SECRETARIA)', () => {
    for (const path of ['/equipos', '/equipos/:id', '/equipos/:id/ficha', '/inventario', '/inventario/movimientos', '/inventario/:id']) {
      const guard = findGuardOf(router.routes as unknown as Rt[], path);
      expect(guard?.element?.props?.allowedRoles).toContain(ROLES.SECRETARIA);
    }
    const venc = findGuardOf(router.routes as unknown as Rt[], '/equipos/vencimientos');
    expect(venc?.element?.props?.allowedRoles).toEqual([ROLES.ADMIN, ROLES.MANTENEDOR, ROLES.SECRETARIA]);
  });
});
