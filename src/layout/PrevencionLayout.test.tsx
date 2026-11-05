import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, cleanup, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';

import { ROLES, type Role } from '../types/roles';
import { PrevencionLayout } from './PrevencionLayout';

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
vi.mock('../offline/outbox', () => ({ countPending: vi.fn() }));

let mockRole: Role = ROLES.PREVENCIONISTA;
vi.mock('../hooks/useCurrentUser', () => ({
  useCurrentUser: () => ({
    user: { id: 'u1', name: 'Paula Rivas', email: 'paula@smi.cl' },
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

function renderLayout(size: 'phone' | 'desktop') {
  mockRole = ROLES.PREVENCIONISTA;
  setViewport(size);
  return render(
    <MemoryRouter initialEntries={['/camioneta']}>
      <Routes>
        <Route element={<PrevencionLayout />}>
          <Route path="/camioneta" element={<p>contenido</p>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('PrevencionLayout', () => {
  it('usa el shell de faena con el subtítulo de Prevención y muestra la camioneta', () => {
    renderLayout('phone');
    expect(screen.getByText('Prevención de riesgos')).toBeTruthy();
    expect(screen.getByText('contenido')).toBeTruthy();
  });

  it('con una sola pantalla no hay barra de navegación, ni en celular ni en escritorio', () => {
    renderLayout('phone');
    expect(screen.queryByRole('navigation', { name: 'Secciones de Prevención' })).toBeNull();
    cleanup();
    renderLayout('desktop');
    expect(screen.queryByRole('navigation', { name: 'Secciones de Prevención' })).toBeNull();
  });
});
