import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, cleanup, screen, within, fireEvent } from '@testing-library/react';
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

// Mismo criterio que `TerrenoLayout.test.tsx`: la campana tiene suite propia y
// sus hooks usan react-query, que este archivo no monta.
vi.mock('../components/notifications/NotificationBell', () => ({
  NotificationBell: () => <div data-testid="notification-bell-stub" />,
}));
vi.mock('../lib/logout', () => ({ logout: vi.fn() }));
// La pestaña Checklist muestra cuántos rechazados hay por corregir.
let rechazados: unknown[] = [];
vi.mock('../hooks/useDailyChecklists', () => ({ useChecklistsPorEstado: () => ({ data: rechazados }) }));
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

  it('MANTENEDOR ve Órdenes, Checklist, Stock, Equipos y su Camioneta en la barra inferior', () => {
    renderLayout('phone', ROLES.MANTENEDOR);

    const nav = screen.getByRole('navigation', { name: 'Secciones de Mantención' });
    const labels = within(nav)
      .getAllByRole('link')
      .map((link) => link.textContent);
    expect(labels).toEqual(['Órdenes', 'Checklist', 'Stock', 'Equipos', 'Camioneta']);
  });

  it('ADMIN ve las cuatro secciones del taller (sin «Mi camioneta», que es del mantenedor)', () => {
    renderLayout('phone', ROLES.ADMIN);

    const nav = screen.getByRole('navigation', { name: 'Secciones de Mantención' });
    const labels = within(nav)
      .getAllByRole('link')
      .map((link) => link.textContent);
    expect(labels).toEqual(['Órdenes', 'Checklist', 'Stock', 'Equipos']);
  });

  it('no hay botón Menú: las secciones están solo en la barra inferior', () => {
    renderLayout('phone', ROLES.MANTENEDOR);

    expect(screen.queryByLabelText('Menú')).toBeNull();
    expect(screen.getAllByRole('link', { name: 'Stock' })).toHaveLength(1);
  });

  it('el menú de usuario del MANTENEDOR no ofrece «Ir al panel»', async () => {
    renderLayout('phone', ROLES.MANTENEDOR);

    fireEvent.click(screen.getByRole('button', { name: 'Menú de usuario' }));
    expect(await screen.findByRole('menuitem', { name: 'Cerrar sesión' })).toBeTruthy();
    expect(screen.queryByRole('menuitem', { name: 'Ir al panel' })).toBeNull();
  });

  it('el ADMIN encuentra «Ir al panel» en el menú de usuario', async () => {
    renderLayout('phone', ROLES.ADMIN);

    fireEvent.click(screen.getByRole('button', { name: 'Menú de usuario' }));
    expect(await screen.findByRole('menuitem', { name: 'Ir al panel' })).toBeTruthy();
  });

  /**
   * El home del MANTENEDOR es el taller, no el escritorio con Topbar: sin la
   * campana acá, "hallazgo creado" o "checklist validado" no tenían ninguna
   * superficie in-app para él.
   */
  it('el header muestra la campana de notificaciones', () => {
    renderLayout('phone', ROLES.MANTENEDOR);

    const header = screen.getByRole('banner');
    expect(header.contains(screen.getByTestId('notification-bell-stub'))).toBe(true);
  });

  it('desde escritorio las secciones suben al header, con sus etiquetas largas', () => {
    renderLayout('desktop', ROLES.ADMIN);

    const nav = screen.getByRole('navigation', { name: 'Secciones de Mantención' });
    expect(screen.getByRole('banner').contains(nav)).toBe(true);
    for (const label of ['Órdenes de trabajo', 'Checklist diario', 'Stock del taller', 'Equipos']) {
      expect(within(nav).getByRole('link', { name: label })).toBeTruthy();
    }
    // Una sola barra montada — mismo criterio que `TerrenoLayout.test.tsx`.
    expect(screen.getAllByRole('navigation', { name: 'Secciones de Mantención' })).toHaveLength(1);
  });
});
