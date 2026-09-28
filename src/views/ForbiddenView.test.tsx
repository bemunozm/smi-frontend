import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

import { ForbiddenView } from './ForbiddenView';
import { ROLES, type Role } from '../types/roles';

let mockRole: Role | null = ROLES.OPERADOR;

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
        <Route element={<div>Sin módulos</div>} path="/sin-modulos" />
      </Routes>
    </MemoryRouter>,
  );
}

describe('ForbiddenView', () => {
  it('OPERADOR vuelve a "sin módulos", no a `/` (que también le está vedado)', () => {
    mockRole = ROLES.OPERADOR;
    renderForbidden();

    fireEvent.click(screen.getByRole('button', { name: 'Volver al inicio' }));

    expect(screen.getByText('Sin módulos')).toBeTruthy();
  });

  it('ADMIN vuelve al dashboard', () => {
    mockRole = ROLES.ADMIN;
    renderForbidden();

    fireEvent.click(screen.getByRole('button', { name: 'Volver al inicio' }));

    expect(screen.getByText('Dashboard')).toBeTruthy();
  });
});
