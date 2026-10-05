import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

import { ForbiddenView } from './ForbiddenView';
import { ROLES, type Role } from '../types/roles';

let mockRole: Role | null = ROLES.ADMIN;

vi.mock('../hooks/useCurrentUser', () => ({
  useCurrentUser: () => ({ role: mockRole }),
}));

afterEach(cleanup);

function renderForbidden() {
  return render(
    <MemoryRouter initialEntries={['/forbidden']}>
      <Routes>
        <Route element={<ForbiddenView />} path="/forbidden" />
        <Route element={<div>Dashboard</div>} path="/" />
      </Routes>
    </MemoryRouter>,
  );
}

describe('ForbiddenView', () => {
  it('ADMIN vuelve al dashboard', () => {
    mockRole = ROLES.ADMIN;
    renderForbidden();

    fireEvent.click(screen.getByRole('button', { name: 'Volver al inicio' }));

    expect(screen.getByText('Dashboard')).toBeTruthy();
  });

  // Un rol nulo (sesión sin rol reconocido, o un rol que ya no existe)
  // también cae a `homePathFor(null) === '/'` — mismo destino que ADMIN/MANTENEDOR, nunca
  // un `undefined`/ruta rota que deje el botón sin adónde ir.
  it('un rol nulo también vuelve al dashboard (mismo destino que ADMIN/MANTENEDOR)', () => {
    mockRole = null;
    renderForbidden();

    fireEvent.click(screen.getByRole('button', { name: 'Volver al inicio' }));

    expect(screen.getByText('Dashboard')).toBeTruthy();
  });
});
