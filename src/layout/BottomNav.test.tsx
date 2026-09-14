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
  it('lleva los cuatro destinos diarios más «Más»', () => {
    renderNav(ROLES.ADMIN);

    for (const label of ['Inicio', 'Equipos', 'Inventario', 'Mantención']) {
      expect(screen.getByText(label)).toBeTruthy();
    }
    expect(screen.getByText('Más')).toBeTruthy();
  });

  it('respeta el permiso por rol de `NAV_ITEMS`', () => {
    // El operador no ve Equipos ni Inventario en el menú lateral; mostrarlos
    // abajo solo lo llevaría a rebotar en /forbidden.
    renderNav(ROLES.OPERADOR);

    expect(screen.getByText('Inicio')).toBeTruthy();
    expect(screen.queryByText('Equipos')).toBeNull();
    expect(screen.queryByText('Inventario')).toBeNull();
  });

  it('«Más» abre el mismo cajón del menú lateral', () => {
    // Mantener dos menús sincronizados es cómo terminan divergiendo: el cajón
    // ya lista todo y ya está filtrado por rol.
    renderNav(ROLES.ADMIN);

    fireEvent.click(screen.getByText('Más'));

    expect(useUiStore.getState().isSidebarOpen).toBe(true);
  });

  it('no se dibuja si el rol no tiene ningún destino', () => {
    const { container } = renderNav(null);
    expect(container.firstChild).toBeNull();
  });
});
