import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, cleanup, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';

import { ROLES, type Role } from '../types/roles';
import { TemporalLayout } from './TemporalLayout';

vi.mock('../lib/auth-client', () => ({ signOut: vi.fn(), useSession: () => ({ data: null, isPending: false }) }));

// Mismo criterio que `TerrenoLayout.test.tsx`: `SyncStatus` tiene suite propia
// y renderizarlo real obligaría a cargar `fake-indexeddb` sin necesitarlo.
vi.mock('../components/terreno/SyncStatus', () => ({ SyncStatus: () => <div data-testid="sync-status-stub" /> }));

// Mismo criterio que `TerrenoLayout.test.tsx`: la campana tiene suite propia y
// sus hooks usan react-query, que este archivo no monta.
vi.mock('../components/notifications/NotificationBell', () => ({
  NotificationBell: () => <div data-testid="notification-bell-stub" />,
}));
vi.mock('../lib/logout', () => ({ logout: vi.fn() }));
vi.mock('../offline/outbox', () => ({ countPending: vi.fn() }));

let mockRole: Role = ROLES.SUPERVISOR_TEMPORAL;
vi.mock('../hooks/useCurrentUser', () => ({
  useCurrentUser: () => ({ user: { id: 'u1', name: 'Tomás Rojas', email: 'tomas@smi.cl' }, role: mockRole }),
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

function renderLayout(size: 'phone' | 'desktop') {
  mockRole = ROLES.SUPERVISOR_TEMPORAL;
  setViewport(size);
  return render(
    <MemoryRouter initialEntries={['/temporal']}>
      <Routes>
        <Route element={<TemporalLayout />}>
          <Route path="/temporal" element={<p>contenido</p>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('TemporalLayout', () => {
  it('usa el shell de faena con el subtítulo de Prevención y muestra la camioneta', () => {
    renderLayout('phone');
    expect(screen.getByText('Supervisión temporal')).toBeTruthy();
    expect(screen.getByText('contenido')).toBeTruthy();
  });

  it('con una sola pantalla no hay barra de navegación, ni en celular ni en escritorio', () => {
    renderLayout('phone');
    expect(screen.queryByRole('navigation', { name: 'Secciones de Supervisión temporal' })).toBeNull();
    cleanup();
    renderLayout('desktop');
    expect(screen.queryByRole('navigation', { name: 'Secciones de Supervisión temporal' })).toBeNull();
  });
});
