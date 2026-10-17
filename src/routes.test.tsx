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
  it('`/` (dashboard) exige rol ADMIN exclusivamente', () => {
    const guard = findGuardOf(router.routes as unknown as Rt[], '/');
    expect(guard?.element?.props?.allowedRoles).toEqual([ROLES.ADMIN]);
  });
});
