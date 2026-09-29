import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

import { HomeRedirect } from './HomeRedirect';
import { ProtectedRoute } from './ProtectedRoute';
import { ROLES, type Role } from '../types/roles';

let mockRole: Role | null = null;

vi.mock('../hooks/useCurrentUser', () => ({
  useCurrentUser: () => ({
    user: null,
    role: mockRole,
    isPending: false,
    isAuthenticated: true,
    isOfflineSnapshot: false,
  }),
}));

afterEach(cleanup);

function renderHomeRedirect() {
  return render(
    <MemoryRouter initialEntries={['/inicio']}>
      <Routes>
        <Route element={<HomeRedirect />} path="/inicio" />
        <Route element={<div>Dashboard</div>} path="/" />
        <Route element={<div>Registro de equipo</div>} path="/terreno/registro" />
      </Routes>
    </MemoryRouter>,
  );
}

describe('HomeRedirect', () => {
  it('SUPERVISOR aterriza en Registro de equipo', () => {
    mockRole = ROLES.SUPERVISOR;
    renderHomeRedirect();
    expect(screen.getByText('Registro de equipo')).toBeTruthy();
  });

  it('ADMIN aterriza en el dashboard', () => {
    mockRole = ROLES.ADMIN;
    renderHomeRedirect();
    expect(screen.getByText('Dashboard')).toBeTruthy();
  });

  it('MANTENEDOR aterriza en el dashboard', () => {
    mockRole = ROLES.MANTENEDOR;
    renderHomeRedirect();
    expect(screen.getByText('Dashboard')).toBeTruthy();
  });

  // Integración con `ProtectedRoute` (mismo anidamiento que `routes.tsx`):
  // un rol nulo (sesión sin rol reconocido, o un rol que ya no existe)
  // aterriza en `/` vía `homePathFor`, pero `ProtectedRoute` lo rebota a
  // `/forbidden` por su `allowedRoles`. Prueba que ese rebote es UN solo salto — nunca un
  // loop de redirects — y que el usuario termina viendo "Sin permiso", no
  // una pantalla en blanco ni el Dashboard.
  it('un rol nulo nunca queda en loop: aterriza en /forbidden en un solo salto', () => {
    mockRole = null;
    render(
      <MemoryRouter initialEntries={['/inicio']}>
        <Routes>
          <Route element={<HomeRedirect />} path="/inicio" />
          <Route element={<ProtectedRoute allowedRoles={[ROLES.ADMIN, ROLES.SUPERVISOR, ROLES.MANTENEDOR]} />}>
            <Route element={<div>Dashboard</div>} path="/" />
          </Route>
          <Route element={<div>Sin permiso</div>} path="/forbidden" />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByText('Sin permiso')).toBeTruthy();
    expect(screen.queryByText('Dashboard')).toBeNull();
  });
});
