import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

import { HomeRedirect } from './HomeRedirect';
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
        <Route element={<div>Sin módulos</div>} path="/sin-modulos" />
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

  it('OPERADOR aterriza en "sin módulos", no en el dashboard', () => {
    mockRole = ROLES.OPERADOR;
    renderHomeRedirect();
    expect(screen.getByText('Sin módulos')).toBeTruthy();
    expect(screen.queryByText('Dashboard')).toBeNull();
  });
});
