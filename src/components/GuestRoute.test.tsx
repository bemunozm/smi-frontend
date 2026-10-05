import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

import { GuestRoute } from './GuestRoute';

interface MockCurrentUser {
  isAuthenticated: boolean;
  isPending: boolean;
}

let mockCurrentUser: MockCurrentUser;

vi.mock('../hooks/useCurrentUser', () => ({
  useCurrentUser: () => mockCurrentUser,
}));

afterEach(cleanup);

function renderGuestRoute() {
  return render(
    <MemoryRouter initialEntries={['/login']}>
      <Routes>
        <Route element={<GuestRoute />}>
          <Route element={<div>Login</div>} path="/login" />
        </Route>
        <Route element={<div>Inicio</div>} path="/inicio" />
      </Routes>
    </MemoryRouter>,
  );
}

describe('GuestRoute', () => {
  it('sin sesión, muestra el login', () => {
    mockCurrentUser = { isAuthenticated: false, isPending: false };
    renderGuestRoute();
    expect(screen.getByText('Login')).toBeTruthy();
  });

  it('con sesión confirmada, redirige a /inicio (no a /)', () => {
    mockCurrentUser = { isAuthenticated: true, isPending: false };
    renderGuestRoute();
    expect(screen.getByText('Inicio')).toBeTruthy();
    expect(screen.queryByText('Login')).toBeNull();
  });

  it('offline con snapshot (useCurrentUser ya resuelve isAuthenticated=true) no queda atrapado en /login', () => {
    // `useCurrentUser` es quien decide esto (ver `useCurrentUser.test.ts`,
    // fallback offline) — acá solo se confirma que `GuestRoute` respeta esa
    // señal y no vuelve a mostrar el formulario de login, que tampoco podría
    // enviarse sin red.
    mockCurrentUser = { isAuthenticated: true, isPending: false };
    renderGuestRoute();
    expect(screen.queryByText('Login')).toBeNull();
  });
});
