import { describe, expect, it } from 'vitest';

import { ROLES } from '../types/roles';
import { NAV_ITEMS } from './nav-items';

describe('NAV_ITEMS', () => {
  it('el Dashboard (`/`) es solo ADMIN: el resto consumiría 403 de /api/dashboard/*', () => {
    const dashboard = NAV_ITEMS.find((item) => item.to === '/');
    expect(dashboard?.roles).toEqual([ROLES.ADMIN]);
  });
});
