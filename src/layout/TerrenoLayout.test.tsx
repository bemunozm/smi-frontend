import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
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

// La campana tiene suite propia (`components/notifications/NotificationBell.test.tsx`)
// y sus hooks usan react-query, que este archivo no monta: acá solo importa
// que el shell la ponga en el header — mismo criterio que `Topbar.test.tsx`.
vi.mock('../components/notifications/NotificationBell', () => ({
  NotificationBell: () => <div data-testid="notification-bell-stub" />,
}));

const { logoutMock, countPendingMock, toastDangerMock } = vi.hoisted(() => ({
  logoutMock: vi.fn(),
  countPendingMock: vi.fn(),
  toastDangerMock: vi.fn(),
}));
vi.mock('../lib/logout', () => ({ logout: logoutMock }));
// La pestaña Checklists muestra cuántos esperan la validación del supervisor.
let porValidar: unknown[] = [];
vi.mock('../hooks/useDailyChecklists', () => ({ useChecklistsPorEstado: () => ({ data: porValidar }) }));
// `offline/outbox.ts` importa Dexie: acá solo importa el número de registros
// sin enviar que ve la confirmación de cerrar sesión.
vi.mock('../offline/outbox', () => ({ countPending: countPendingMock }));
let mockRole: 'SUPERVISOR' | 'ADMIN' = 'SUPERVISOR';
vi.mock('../hooks/useCurrentUser', () => ({
  useCurrentUser: () => ({ user: { id: 'u1', name: 'Ana Soto', email: 'ana@smi.cl' }, role: mockRole }),
}));

vi.mock('@heroui/react', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@heroui/react')>()),
  toast: Object.assign(vi.fn(), { danger: toastDangerMock }),
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
  phone: ['Registro', 'Reporte', 'Trabajos', 'Hallazgos', 'Checklists'],
  desktop: ['Registro de equipo', 'Reporte diario', 'Trabajos extra', 'Hallazgos', 'Checklists'],
} as const;

afterEach(() => {
  mockRole = 'SUPERVISOR';
  cleanup();
  vi.clearAllMocks();
  porValidar = [];
});

describe('TerrenoLayout', () => {
  it('en teléfono deja las secciones en la barra inferior', () => {
    renderLayout('phone');

    const nav = screen.getByRole('navigation', { name: 'Secciones de Terreno' });
    for (const seccion of SECCIONES.phone) {
      expect(within(nav).getByRole('link', { name: seccion })).toBeTruthy();
    }
  });

  it('la pestaña Checklists dice cuántos esperan la validación del supervisor', () => {
    porValidar = [{ id: 'a' }, { id: 'b' }];
    renderLayout('phone');

    const nav = screen.getByRole('navigation', { name: 'Secciones de Terreno' });
    expect(within(nav).getByLabelText('2 pendientes')).toBeTruthy();
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

  it('el SUPERVISOR no ve «Ir al panel»: el dashboard es solo ADMIN y Terreno ya es su home', async () => {
    renderLayout('phone');

    fireEvent.click(screen.getByRole('button', { name: 'Menú de usuario' }));
    expect(await screen.findByRole('menuitem', { name: 'Cerrar sesión' })).toBeTruthy();
    expect(screen.queryByRole('menuitem', { name: 'Ir al panel' })).toBeNull();
  });

  it('el ADMIN tiene «Ir al panel» en el menú de usuario, en escritorio y en teléfono', async () => {
    mockRole = 'ADMIN';
    for (const size of ['desktop', 'phone'] as const) {
      renderLayout(size);
      fireEvent.click(screen.getByRole('button', { name: 'Menú de usuario' }));
      expect(await screen.findByRole('menuitem', { name: 'Ir al panel' })).toBeTruthy();
      cleanup();
    }
  });

  it('en teléfono no hay botón Menú: las secciones van una sola vez, en la barra inferior', () => {
    mockRole = 'ADMIN';
    renderLayout('phone');

    expect(screen.queryByLabelText('Menú')).toBeNull();
    expect(screen.getAllByRole('link', { name: 'Hallazgos' })).toHaveLength(1);
  });

  /**
   * «Cerrar sesión» vive en el menú de usuario del header (avatar, igual que
   * el administrador).
   */
  it('«Cerrar sesión» está en el menú de usuario del header', async () => {
    renderLayout('phone');

    fireEvent.click(screen.getByRole('button', { name: 'Menú de usuario' }));
    expect(await screen.findByRole('menuitem', { name: 'Cerrar sesión' })).toBeTruthy();
    expect(screen.getByRole('menuitem', { name: 'Ver perfil' })).toBeTruthy();
  });

  it('«Ver perfil» abre el perfil en un popup, sin salir del shell', async () => {
    renderLayout('phone');

    fireEvent.click(screen.getByRole('button', { name: 'Menú de usuario' }));
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Ver perfil' }));

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getAllByText('ana@smi.cl').length).toBeGreaterThanOrEqual(1);
    expect(within(dialog).getAllByText('Ana Soto').length).toBeGreaterThanOrEqual(1);
  });

  it('en escritorio tampoco hay botón Menú', () => {
    renderLayout('desktop');

    expect(screen.queryByLabelText('Menú')).toBeNull();
  });

  it('monta el `SyncStatus` real (reemplaza a la vieja `BarraSinSenal`)', () => {
    renderLayout('desktop');
    expect(screen.getByTestId('sync-status-stub')).toBeTruthy();
  });

  /**
   * El home del SUPERVISOR es este shell, no el escritorio con Topbar: sin la
   * campana acá, sus notificaciones (checklist por validar, stock bajo) no
   * tenían ninguna superficie in-app.
   */
  it.each(['phone', 'desktop'] as const)('el header muestra la campana de notificaciones en %s', (size) => {
    renderLayout(size);

    const header = screen.getByRole('banner');
    expect(header.contains(screen.getByTestId('notification-bell-stub'))).toBe(true);
  });

  /**
   * Cerrar sesión con registros sin enviar: se puede, pero antes se confirma y se
   * dice cuántos quedan y qué pasa con ellos. La cola no se borra (`lib/logout.ts`).
   */
  describe('salir con registros sin enviar', () => {
    beforeEach(() => {
      logoutMock.mockResolvedValue(undefined);
      countPendingMock.mockResolvedValue(0);
    });

    // Cerrar sesión ahora vive en el menú de usuario del header (avatar).
    async function pedirCerrarSesion() {
      fireEvent.click(screen.getByRole('button', { name: 'Menú de usuario' }));
      fireEvent.click(await screen.findByRole('menuitem', { name: 'Cerrar sesión' }));
    }

    it('sin pendientes: cierra sesión directo, sin confirmación ni aviso', async () => {
      renderLayout('desktop');

      await pedirCerrarSesion();

      await waitFor(() => expect(logoutMock).toHaveBeenCalledTimes(1));
      expect(countPendingMock).toHaveBeenCalledWith('u1');
      expect(screen.queryByRole('alertdialog')).toBeNull();
      expect(toastDangerMock).not.toHaveBeenCalled();
    });

    it('con pendientes: pide confirmación con el aviso y cierra solo al confirmar', async () => {
      countPendingMock.mockResolvedValue(2);
      renderLayout('desktop');

      await pedirCerrarSesion();

      const dialogo = await screen.findByRole('alertdialog');
      expect(dialogo.textContent).toContain('Hay 2 registros sin enviar.');
      expect(dialogo.textContent).toContain('se envían cuando vuelvas a iniciar sesión acá');
      expect(logoutMock).not.toHaveBeenCalled();

      fireEvent.click(within(dialogo).getByRole('button', { name: 'Cerrar sesión' }));
      await waitFor(() => expect(logoutMock).toHaveBeenCalledTimes(1));
    });

    it('si cerrar la sesión falla, avisa en vez de dejar la excepción suelta', async () => {
      logoutMock.mockRejectedValueOnce(new Error('network'));
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      renderLayout('desktop');

      await pedirCerrarSesion();

      await waitFor(() => expect(toastDangerMock).toHaveBeenCalledTimes(1));
      expect(toastDangerMock.mock.calls[0]![0]).toMatch(/No se pudo cerrar la sesión/);
      consoleErrorSpy.mockRestore();
    });
  });
});
