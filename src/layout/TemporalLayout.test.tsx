import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, cleanup, screen, within } from '@testing-library/react';
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

function renderLayout(size: 'phone' | 'desktop', ruta = '/temporal') {
  mockRole = ROLES.SUPERVISOR_TEMPORAL;
  setViewport(size);
  return render(
    <MemoryRouter initialEntries={[ruta]}>
      <Routes>
        <Route element={<TemporalLayout />}>
          <Route path="/temporal" element={<p>contenido</p>} />
          <Route path="/temporal/camioneta" element={<p>camioneta</p>} />
          <Route path="/temporal/hallazgos" element={<p>hallazgos</p>} />
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

  it('tres pestañas en orden: Mis equipos, Mi camioneta y Hallazgos (barra inferior en celular)', () => {
    renderLayout('phone');
    const nav = screen.getByRole('navigation', { name: 'Secciones de Supervisión temporal' });
    const enlaces = within(nav).getAllByRole('link');
    expect(enlaces.map((a) => a.textContent)).toEqual(['Equipos', 'Camioneta', 'Hallazgos']);
    expect(enlaces.map((a) => a.getAttribute('href'))).toEqual([
      '/temporal',
      '/temporal/camioneta',
      '/temporal/hallazgos',
    ]);
  });

  it('en escritorio las pestañas van en el header con su nombre largo', () => {
    renderLayout('desktop');
    const nav = screen.getByRole('navigation', { name: 'Secciones de Supervisión temporal' });
    const nombres = within(nav)
      .getAllByRole('link')
      .map((a) => a.textContent);
    expect(nombres).toEqual(['Mis equipos', 'Mi camioneta', 'Hallazgos']);
  });

  it('en «Mi camioneta» solo esa pestaña queda activa', () => {
    renderLayout('phone', '/temporal/camioneta');
    expect(screen.getByText('camioneta')).toBeTruthy();
    const nav = screen.getByRole('navigation', { name: 'Secciones de Supervisión temporal' });
    expect(within(nav).getByRole('link', { name: 'Camioneta' }).getAttribute('aria-current')).toBe('page');
    expect(within(nav).getByRole('link', { name: 'Equipos' }).getAttribute('aria-current')).toBeNull();
  });

  it('en «Hallazgos» solo esa pestaña queda activa, no «Mis equipos»', () => {
    renderLayout('phone', '/temporal/hallazgos');
    expect(screen.getByText('hallazgos')).toBeTruthy();
    const nav = screen.getByRole('navigation', { name: 'Secciones de Supervisión temporal' });
    expect(within(nav).getByRole('link', { name: 'Hallazgos' }).getAttribute('aria-current')).toBe('page');
    expect(within(nav).getByRole('link', { name: 'Equipos' }).getAttribute('aria-current')).toBeNull();
  });
});
