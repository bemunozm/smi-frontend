import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';
import { createMemoryRouter, Link, RouterProvider } from 'react-router-dom';

import { SyncEngineMount } from './SyncEngineMount';

const { useSyncEngineMock, useSyncStateMock, clearEngineNoticeMock, toastMock } = vi.hoisted(() => ({
  useSyncEngineMock: vi.fn(),
  useSyncStateMock: vi.fn((): { notice: string | null } => ({ notice: null })),
  clearEngineNoticeMock: vi.fn(),
  toastMock: vi.fn(),
}));

vi.mock('../offline/replay', () => ({
  useSyncEngine: useSyncEngineMock,
  useSyncState: useSyncStateMock,
  clearEngineNotice: clearEngineNoticeMock,
}));

vi.mock('../hooks/useCurrentUser', () => ({
  useCurrentUser: () => ({ user: { id: 'u1' } }),
}));

vi.mock('@heroui/react', () => ({ toast: toastMock }));

function Page({ label }: { label: string }) {
  return (
    <div>
      <span>{label}</span>
      <Link to="/otra">ir a otra ruta</Link>
      <Link to="/">volver</Link>
    </div>
  );
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  useSyncStateMock.mockReturnValue({ notice: null });
});

describe('SyncEngineMount', () => {
  it('monta el motor de sync UNA sola vez y sigue montado al navegar entre rutas hijas', () => {
    const router = createMemoryRouter([
      {
        element: <SyncEngineMount />,
        children: [
          { path: '/', element: <Page label="panel" /> },
          { path: '/otra', element: <Page label="terreno" /> },
        ],
      },
    ]);
    render(<RouterProvider router={router} />);

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
    useSyncStateMock.mockReturnValue({ notice: 'Reporte enviado con equipos faltantes' });
    const router = createMemoryRouter([
      { element: <SyncEngineMount />, children: [{ path: '/', element: <Page label="panel" /> }] },
    ]);
    render(<RouterProvider router={router} />);

    expect(toastMock).toHaveBeenCalledWith('Reporte enviado con equipos faltantes');
    expect(clearEngineNoticeMock).toHaveBeenCalledTimes(1);
  });

  it('sin notice, no dispara ningún toast', () => {
    const router = createMemoryRouter([
      { element: <SyncEngineMount />, children: [{ path: '/', element: <Page label="panel" /> }] },
    ]);
    render(<RouterProvider router={router} />);

    expect(toastMock).not.toHaveBeenCalled();
    expect(clearEngineNoticeMock).not.toHaveBeenCalled();
  });
});
