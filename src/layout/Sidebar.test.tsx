import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

import { ROLES, type Role } from '../types/roles';
import { Sidebar } from './Sidebar';

function renderSidebar(role: Role) {
  return render(
    <MemoryRouter>
      <Sidebar role={role} />
    </MemoryRouter>,
  );
}

afterEach(cleanup);

describe('Sidebar — menú agrupado por secciones', () => {
  it('ADMIN ve las tres secciones con sus items agrupados', () => {
    renderSidebar(ROLES.ADMIN);

    const nav = screen.getByRole('navigation');
    for (const seccion of ['Administración', 'Reportes', 'Usuarios']) {
      expect(within(nav).getByTestId(`seccion-${seccion}`)).toBeTruthy();
    }
    // Un item representativo de cada sección.
    expect(within(nav).getByRole('link', { name: 'Dashboard' })).toBeTruthy();
    expect(within(nav).getByRole('link', { name: 'Mantenciones' })).toBeTruthy();
    expect(within(nav).getByRole('link', { name: 'Usuarios' })).toBeTruthy();
  });

  it('una sección sin items para el rol NO muestra su título: SUPERVISOR no tiene Reportes', () => {
    renderSidebar(ROLES.SUPERVISOR);

    const nav = screen.getByRole('navigation');
    expect(within(nav).getByTestId('seccion-Administración')).toBeTruthy();
    expect(within(nav).queryByTestId('seccion-Reportes')).toBeNull();
    expect(within(nav).getByRole('link', { name: 'Operadores' })).toBeTruthy();
    expect(within(nav).queryByRole('link', { name: 'Dashboard' })).toBeNull();
  });

  it('MANTENEDOR: Administración (Equipos, Inventario) y Usuarios (solo Notificaciones)', () => {
    renderSidebar(ROLES.MANTENEDOR);

    const nav = screen.getByRole('navigation');
    const links = within(nav)
      .getAllByRole('link')
      .map((link) => link.textContent);
    expect(links).toEqual(['Equipos', 'Inventario', 'Notificaciones']);
    expect(within(nav).queryByTestId('seccion-Reportes')).toBeNull();
  });
});
