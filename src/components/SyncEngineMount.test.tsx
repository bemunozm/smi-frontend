import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import { createMemoryRouter, Link, RouterProvider } from 'react-router-dom';

import { SyncEngineMount } from './SyncEngineMount';
import { queryClient } from '../lib/query-client';

const { useSyncEngineMock, useSyncStateMock, clearEngineNoticeMock, toastMock, persistMock, dbMock } = vi.hoisted(
  () => ({
    useSyncEngineMock: vi.fn(),
    useSyncStateMock: vi.fn((): { notice: string | null; otherAccountCount: number } => ({
      notice: null,
      otherAccountCount: 0,
    })),
    clearEngineNoticeMock: vi.fn(),
    toastMock: vi.fn(),
    persistMock: vi.fn(),
    dbMock: vi.fn(),
  }),
);

vi.mock('../offline/replay', () => ({
  useSyncEngine: useSyncEngineMock,
  useSyncState: useSyncStateMock,
  clearEngineNotice: clearEngineNoticeMock,
}));

let currentUser: { user: { id: string } | null; isOfflineSnapshot: boolean } = {
  user: { id: 'u1' },
  isOfflineSnapshot: false,
};
vi.mock('../hooks/useCurrentUser', () => ({ useCurrentUser: () => currentUser }));

vi.mock('@heroui/react', () => ({ toast: toastMock, Button: () => null }));
vi.mock('../offline/persist-storage', () => ({ requestPersistentStorage: persistMock }));
vi.mock('../offline/useOfflineDb', () => ({ useOfflineDb: dbMock }));

const OWNER_KEY = 'smi-cache-owner';

function Page({ label, onRender }: { label: string; onRender?: () => void }) {
  onRender?.();
  return (
    <div>
      <span>{label}</span>
      <Link to="/otra">ir a otra ruta</Link>
      <Link to="/">volver</Link>
    </div>
  );
}

function renderMount(onRender?: () => void) {
  const router = createMemoryRouter([
    {
      element: <SyncEngineMount />,
      children: [
        { path: '/', element: <Page label="panel" onRender={onRender} /> },
        { path: '/otra', element: <Page label="terreno" /> },
      ],
    },
  ]);
  return render(<RouterProvider router={router} />);
}

beforeEach(() => {
  currentUser = { user: { id: 'u1' }, isOfflineSnapshot: false };
  dbMock.mockReturnValue({ status: 'ready', retry: vi.fn() });
  persistMock.mockResolvedValue(true);
  window.localStorage.clear();
  queryClient.clear();
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  useSyncStateMock.mockReturnValue({ notice: null, otherAccountCount: 0 });
});

describe('SyncEngineMount', () => {
  it('monta el motor de sync UNA sola vez y sigue montado al navegar entre rutas hijas', () => {
    renderMount();

    expect(useSyncEngineMock).toHaveBeenCalledTimes(1);
    expect(useSyncEngineMock).toHaveBeenCalledWith('u1');
    expect(screen.getByText('panel')).toBeTruthy();

    fireEvent.click(screen.getByText('ir a otra ruta'));
    expect(screen.getByText('terreno')).toBeTruthy();
    // El layout route (`SyncEngineMount`) no se desmontó al cambiar de
    // ruta hija — `useSyncEngine()` no se volvió a invocar desde cero.
    expect(useSyncEngineMock).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByText('volver'));
    expect(screen.getByText('panel')).toBeTruthy();
    expect(useSyncEngineMock).toHaveBeenCalledTimes(1);
  });

  it('presenta el aviso puntual del motor (notice) con un toast y lo limpia', () => {
    useSyncStateMock.mockReturnValue({ notice: 'Reporte enviado con equipos faltantes', otherAccountCount: 0 });
    renderMount();

    expect(toastMock).toHaveBeenCalledWith('Reporte enviado con equipos faltantes');
    expect(clearEngineNoticeMock).toHaveBeenCalledTimes(1);
  });

  it('sin notice, no dispara ningún toast', () => {
    renderMount();

    expect(toastMock).not.toHaveBeenCalled();
    expect(clearEngineNoticeMock).not.toHaveBeenCalled();
  });

  it('pide almacenamiento persistente al confirmarse la sesión, una sola vez', async () => {
    renderMount();

    await waitFor(() => expect(persistMock).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getByText('ir a otra ruta'));
    expect(persistMock).toHaveBeenCalledTimes(1);
  });

  it('con la sesión guardada de un arranque sin señal no toca el almacenamiento ni las cachés', async () => {
    currentUser = { user: { id: 'u1' }, isOfflineSnapshot: true };
    window.localStorage.setItem(OWNER_KEY, JSON.stringify('u0'));
    queryClient.setQueryData(['equipment'], [{ id: 'eq-1' }]);
    renderMount();

    expect(screen.getByText('panel')).toBeTruthy();
    expect(persistMock).not.toHaveBeenCalled();
    expect(queryClient.getQueryData(['equipment'])).toEqual([{ id: 'eq-1' }]);
  });
});

describe('SyncEngineMount — cachés de otra sesión', () => {
  it('si el equipo guardaba las cachés de OTRO usuario las purga antes de pintar nada que cuelgue de ellas', async () => {
    window.localStorage.setItem(OWNER_KEY, JSON.stringify('u0'));
    queryClient.setQueryData(['equipment'], [{ id: 'eq-de-u0' }]);
    const vistoAlPintar: unknown[] = [];

    renderMount(() => vistoAlPintar.push(queryClient.getQueryData(['equipment'])));

    await waitFor(() => expect(screen.getByText('panel')).toBeTruthy());
    expect(queryClient.getQueryData(['equipment'])).toBeUndefined();
    // La pantalla nunca llegó a pintar con los datos de la sesión anterior.
    expect(vistoAlPintar.every((visto) => visto === undefined)).toBe(true);
    expect(JSON.parse(window.localStorage.getItem(OWNER_KEY) ?? 'null')).toBe('u1');
  });

  it('si la sesión anterior venció (misma persona), también se purgan', async () => {
    window.localStorage.setItem(OWNER_KEY, JSON.stringify(''));
    queryClient.setQueryData(['equipment'], [{ id: 'eq-1' }]);

    renderMount();

    await waitFor(() => expect(screen.getByText('panel')).toBeTruthy());
    expect(queryClient.getQueryData(['equipment'])).toBeUndefined();
  });

  it('si no se puede anotar el dueño (almacenamiento lleno) igual pinta: nunca deja la pantalla en blanco', async () => {
    window.localStorage.setItem(OWNER_KEY, JSON.stringify('u0'));
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('quota', 'QuotaExceededError');
    });
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    renderMount();

    await waitFor(() => expect(screen.getByText('panel')).toBeTruthy());
    consoleErrorSpy.mockRestore();
    vi.restoreAllMocks();
  });

  it('con el mismo dueño no se purga nada', async () => {
    window.localStorage.setItem(OWNER_KEY, JSON.stringify('u1'));
    queryClient.setQueryData(['equipment'], [{ id: 'eq-1' }]);

    renderMount();

    await waitFor(() => expect(screen.getByText('panel')).toBeTruthy());
    expect(queryClient.getQueryData(['equipment'])).toEqual([{ id: 'eq-1' }]);
  });

  it('sin dueño registrado (primera vez en el equipo) lo adopta sin borrar nada', async () => {
    queryClient.setQueryData(['equipment'], [{ id: 'eq-1' }]);

    renderMount();

    await waitFor(() => expect(JSON.parse(window.localStorage.getItem(OWNER_KEY) ?? 'null')).toBe('u1'));
    expect(queryClient.getQueryData(['equipment'])).toEqual([{ id: 'eq-1' }]);
  });
});

describe('SyncEngineMount — base local', () => {
  it('si la base local no abre, muestra qué hacer en vez de la app y no arranca el motor', () => {
    const retry = vi.fn();
    dbMock.mockReturnValue({ status: 'failed', retry });

    renderMount();

    expect(screen.getByRole('alert').textContent).toContain('No se puede abrir el almacenamiento del equipo');
    expect(screen.queryByText('panel')).toBeNull();
    expect(useSyncEngineMock).toHaveBeenCalledWith(null);
  });
});

describe('SyncEngineMount — registros de otra cuenta', () => {
  it('avisa una sola vez, sin datos, cuántos registros de otra cuenta guarda el equipo', () => {
    useSyncStateMock.mockReturnValue({ notice: null, otherAccountCount: 2 });
    renderMount();

    expect(toastMock).toHaveBeenCalledTimes(1);
    expect(toastMock.mock.calls[0]![0]).toMatch(/2 registros sin enviar de otra cuenta/);

    fireEvent.click(screen.getByText('ir a otra ruta'));
    expect(toastMock).toHaveBeenCalledTimes(1);
  });
});
