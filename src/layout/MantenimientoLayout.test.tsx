import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, cleanup, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';

import { ROLES, type Role } from '../types/roles';
import { MantenimientoLayout } from './MantenimientoLayout';

vi.mock('../lib/auth-client', () => ({
  signOut: vi.fn(),
  useSession: () => ({ data: null, isPending: false }),
}));

// Mismo criterio que `TerrenoLayout.test.tsx`: `SyncStatus` tiene suite propia
// y renderizarlo real obligaría a cargar `fake-indexeddb` sin necesitarlo.
vi.mock('../components/terreno/SyncStatus', () => ({
  SyncStatus: () => <div data-testid="sync-status-stub" />,
}));
vi.mock('../lib/logout', () => ({ logout: vi.fn() }));
vi.mock('../offline/outbox', () => ({ countPending: vi.fn() }));

let mockRole: Role = ROLES.MANTENEDOR;
vi.mock('../hooks/useCurrentUser', () => ({
  useCurrentUser: () => ({
    user: { id: 'u1', name: 'Marco Díaz', email: 'marco@smi.cl' },
    role: mockRole,
  }),
}));

/** Igual que en `TerrenoLayout.test.tsx`: jsdom no cambia de tamaño. */
function setViewport(size: 'phone' | 'desktop'): void {
  window.matchMedia = ((query: string) => ({
    matches: size === 'desktop' && query.includes('1024px'),
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
}

function renderLayout(size: 'phone' | 'desktop', role: Role) {
  mockRole = role;
  setViewport(size);
  return render(
    <MemoryRouter initialEntries={['/mantenimiento/ordenes']}>
      <Routes>
        <Route element={<MantenimientoLayout />}>
          <Route path="/mantenimiento/ordenes" element={<p>contenido</p>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('MantenimientoLayout', () => {
  it('usa el shell de Terreno: header SMI con subtítulo del taller y sin el chrome del administrador', () => {
    renderLayout('phone', ROLES.MANTENEDOR);

    expect(screen.getByText('Mantención de taller')).toBeTruthy();
    expect(screen.getByTestId('sync-status-stub')).toBeTruthy();
    // El punto del cambio: ya no se monta la barra global del administrador.
    expect(screen.queryByRole('navigation', { name: 'Navegación principal' })).toBeNull();
  });

  it('MANTENEDOR ve solo Órdenes y Stock en la barra inferior', () => {
    renderLayout('phone', ROLES.MANTENEDOR);

    const nav = screen.getByRole('navigation', { name: 'Secciones de Mantención' });
    const labels = within(nav)
      .getAllByRole('link')
      .map((link) => link.textContent);
    expect(labels).toEqual(['Órdenes', 'Stock']);
  });

  it('ADMIN ve también Preventivo y Tareas', () => {
    renderLayout('phone', ROLES.ADMIN);

    const nav = screen.getByRole('navigation', { name: 'Secciones de Mantención' });
    const labels = within(nav)
      .getAllByRole('link')
      .map((link) => link.textContent);
    expect(labels).toEqual(['Órdenes', 'Stock', 'Preventivo', 'Tareas']);
  });

  it('desde escritorio las secciones suben al header, con sus etiquetas largas', () => {
    renderLayout('desktop', ROLES.ADMIN);

    const nav = screen.getByRole('navigation', { name: 'Secciones de Mantención' });
    expect(screen.getByRole('banner').contains(nav)).toBe(true);
    for (const label of ['Órdenes de trabajo', 'Stock del taller', 'Plan preventivo', 'Tareas']) {
      expect(within(nav).getByRole('link', { name: label })).toBeTruthy();
    }
    // Una sola barra montada — mismo criterio que `TerrenoLayout.test.tsx`.
    expect(screen.getAllByRole('navigation', { name: 'Secciones de Mantención' })).toHaveLength(1);
  });
});
