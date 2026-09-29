import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, cleanup, screen, within, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { TerrenoLayout } from './TerrenoLayout';

vi.mock('../lib/auth-client', () => ({
  signOut: vi.fn(),
  useSession: () => ({ data: null, isPending: false }),
}));

// `SyncStatus` tiene sus propios tests (`components/terreno/SyncStatus.test.tsx`,
// incluido el candado de Dexie vía `fake-indexeddb`) — acá se mockea como un
// stub liviano: este archivo prueba la navegación/drawer del layout, no el
// motor de sync, y renderizarlo real obligaría a este archivo a cargar
// `fake-indexeddb` sin necesitarlo.
vi.mock('../components/terreno/SyncStatus', () => ({
  SyncStatus: () => <div data-testid="sync-status-stub" />,
}));

const { requestSyncMock } = vi.hoisted(() => ({ requestSyncMock: vi.fn() }));
vi.mock('../offline/replay', () => ({ requestSync: requestSyncMock }));

// `LogoutBlockedError` real vive en `lib/logout.ts`, que importa
// `offline/outbox.ts` (Dexie) — cargar ese módulo de verdad acá obligaría a
// este archivo a arrastrar `fake-indexeddb` sin necesitarlo (el candado de
// logout en sí ya tiene su propia cobertura en `lib/logout.test.ts`). Se
// mockea una clase equivalente: a `TerrenoLayout.tsx` solo le importa poder
// hacer `error instanceof LogoutBlockedError` y leer `.message`.
const { logoutMock, LogoutBlockedErrorMock } = vi.hoisted(() => {
  class LogoutBlockedErrorMock extends Error {
    pendingCount: number;
    constructor(pendingCount: number) {
      super(`Hay ${pendingCount} registro(s) sin sincronizar — sincronizá antes de salir.`);
      this.pendingCount = pendingCount;
    }
  }
  return { logoutMock: vi.fn(), LogoutBlockedErrorMock };
});
vi.mock('../lib/logout', () => ({ logout: logoutMock, LogoutBlockedError: LogoutBlockedErrorMock }));

const { toastDangerMock } = vi.hoisted(() => ({ toastDangerMock: vi.fn() }));
vi.mock('@heroui/react', () => ({ toast: { danger: toastDangerMock } }));

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

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

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

  it('monta el `SyncStatus` real (reemplaza a la vieja `BarraSinSenal`)', () => {
    renderLayout('desktop');
    expect(screen.getByTestId('sync-status-stub')).toBeTruthy();
  });

  /**
   * `logout()` (`lib/logout.ts`) se bloquea con
   * `LogoutBlockedError` si el usuario tiene operaciones sin sincronizar —
   * el layout debe atrapar ESE error puntual (no cualquier otro) y ofrecer
   * "Sincronizar ahora" en vez de dejar que la excepción se propague.
   */
  describe('salir con pendientes sin sincronizar', () => {
    it('logout exitoso: navega igual que siempre, sin mostrar ningún aviso', async () => {
      logoutMock.mockResolvedValueOnce(undefined);
      renderLayout('desktop');
      fireEvent.click(screen.getByLabelText('Menú'));

      fireEvent.click(screen.getByRole('button', { name: 'Salir' }));

      await waitFor(() => expect(logoutMock).toHaveBeenCalledTimes(1));
      expect(toastDangerMock).not.toHaveBeenCalled();
    });

    it('logout bloqueado: muestra el aviso con la acción "Sincronizar ahora"', async () => {
      logoutMock.mockRejectedValueOnce(new LogoutBlockedErrorMock(2));
      renderLayout('desktop');
      fireEvent.click(screen.getByLabelText('Menú'));

      fireEvent.click(screen.getByRole('button', { name: 'Salir' }));

      await waitFor(() => expect(toastDangerMock).toHaveBeenCalledTimes(1));
      const [message, options] = toastDangerMock.mock.calls[0]!;
      expect(message).toMatch(/2 registro\(s\) sin sincronizar/);
      expect(options.actionProps.children).toBe('Sincronizar ahora');

      options.actionProps.onPress();
      expect(requestSyncMock).toHaveBeenCalledTimes(1);
    });
  });
});
