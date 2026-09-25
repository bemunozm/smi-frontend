import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, cleanup, screen, within, fireEvent } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { TerrenoLayout } from './TerrenoLayout';

vi.mock('../lib/auth-client', () => ({
  signOut: vi.fn(),
  useSession: () => ({ data: null, isPending: false }),
}));

/**
 * El layout elige DÓNDE vive la navegación según el ancho, y esa elección pasa
 * por `useMediaQuery` — que lee `window.matchMedia`. jsdom no cambia de tamaño,
 * así que el viewport se simula acá igual que en `InventarioView.test.tsx`.
 */
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
  setViewport(size);
  return render(
    <MemoryRouter initialEntries={['/terreno/registro']}>
      <Routes>
        <Route element={<TerrenoLayout />}>
          <Route path="/terreno/registro" element={<p>contenido</p>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

/**
 * Cada destino tiene dos etiquetas: la larga para el header y el drawer, y la
 * corta para la barra inferior, donde hay un cuarto de pantalla por pestaña.
 * Solo se monta una de las dos barras, así que en cada tamaño el destino tiene
 * un único nombre accesible — el que corresponde a la barra que está en uso.
 */
const SECCIONES = {
  phone: ['Registro', 'Reporte', 'Trabajos', 'Hallazgos'],
  desktop: ['Registro de equipo', 'Reporte diario', 'Trabajos extra', 'Hallazgos'],
} as const;

afterEach(cleanup);

describe('TerrenoLayout', () => {
  it('en teléfono deja las secciones en la barra inferior', () => {
    renderLayout('phone');

    const nav = screen.getByRole('navigation', { name: 'Secciones de Terreno' });
    for (const seccion of SECCIONES.phone) {
      expect(within(nav).getByRole('link', { name: seccion })).toBeTruthy();
    }
  });

  it('desde escritorio sube las secciones al header', () => {
    renderLayout('desktop');

    const nav = screen.getByRole('navigation', { name: 'Secciones de Terreno' });
    expect(within(nav).getByRole('link', { name: 'Hallazgos' })).toBeTruthy();

    // El header es la única barra: la inferior no se monta, no queda escondida.
    expect(screen.getByRole('banner').contains(nav)).toBe(true);
  });

  /**
   * El punto del cambio: son los mismos cuatro enlaces, y montar las dos barras
   * para tapar una con CSS dejaría la navegación dos veces en el DOM — un
   * lector de pantalla la leería duplicada. Es el criterio que documenta
   * `useMediaQuery`, y este test es el que lo sostiene.
   */
  it.each(['phone', 'desktop'] as const)('no duplica la navegación en %s', (size) => {
    renderLayout(size);

    expect(screen.getAllByRole('navigation', { name: 'Secciones de Terreno' })).toHaveLength(1);
    for (const seccion of SECCIONES[size]) {
      expect(screen.getAllByRole('link', { name: seccion })).toHaveLength(1);
    }
  });

  it('en escritorio el drawer guarda lo que no está en el header, sin repetir las secciones', () => {
    renderLayout('desktop');
    fireEvent.click(screen.getByLabelText('Menú'));

    expect(screen.getByRole('link', { name: 'Ir al panel' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Salir' })).toBeTruthy();
    for (const seccion of SECCIONES.desktop) {
      expect(screen.getAllByRole('link', { name: seccion })).toHaveLength(1);
    }
  });

  it('en teléfono el drawer sí repite las secciones, porque es el menú completo', () => {
    renderLayout('phone');
    fireEvent.click(screen.getByLabelText('Menú'));

    expect(screen.getAllByRole('link', { name: 'Hallazgos' })).toHaveLength(2);
    expect(screen.getByRole('link', { name: 'Ir al panel' })).toBeTruthy();
  });
});
