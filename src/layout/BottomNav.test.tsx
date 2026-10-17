import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

import { BottomNav } from './BottomNav';
import { useUiStore } from '../store/ui';
import { ROLES } from '../types/roles';

afterEach(() => {
  cleanup();
  useUiStore.setState({ isSidebarOpen: false });
});

function renderNav(role: Parameters<typeof BottomNav>[0]['role']) {
  return render(
    <MemoryRouter>
      <BottomNav role={role} />
    </MemoryRouter>,
  );
}

describe('BottomNav', () => {
  it('ADMIN ve Inicio, Equipos, Inventario y Mantención, sin Terreno', () => {
    renderNav(ROLES.ADMIN);

    for (const label of ['Inicio', 'Equipos', 'Inventario', 'Mantención']) {
      expect(screen.getByText(label)).toBeTruthy();
    }
    expect(screen.queryByText('Terreno')).toBeNull();
    expect(screen.getByText('Más')).toBeTruthy();
  });

  it('MANTENEDOR ve Mantención primero, sin Inicio (el dashboard es solo ADMIN)', () => {
    renderNav(ROLES.MANTENEDOR);

    const nav = screen.getByRole('navigation', { name: 'Navegación principal' });
    expect(Array.from(nav.querySelectorAll('a')).map((link) => link.textContent)).toEqual([
      'Mantención',
      'Equipos',
      'Inventario',
    ]);
    expect(screen.queryByText('Inicio')).toBeNull();
  });

  it('SUPERVISOR ve Terreno primero, después Equipos, Inventario — sin Inicio ni Mantención', () => {
    renderNav(ROLES.SUPERVISOR);

    const nav = screen.getByRole('navigation', { name: 'Navegación principal' });
    // El orden en el DOM importa: Terreno primero (donde vive el trabajo
    // diario de SUPERVISOR), no al final como en el resto de los roles.
    const links = nav.querySelectorAll('a');
    expect(Array.from(links).map((link) => link.textContent)).toEqual([
      'Terreno',
      'Equipos',
      'Inventario',
    ]);

    expect(screen.queryByText('Mantención')).toBeNull();
  });

  it('«Más» abre el mismo cajón del menú lateral', () => {
    renderNav(ROLES.ADMIN);

    fireEvent.click(screen.getByText('Más'));

    expect(useUiStore.getState().isSidebarOpen).toBe(true);
  });

  it('no se dibuja si el rol no tiene ningún destino', () => {
    const { container } = renderNav(null);
    expect(container.firstChild).toBeNull();
  });
});
