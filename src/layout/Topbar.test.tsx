import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

import type { OutboxOp } from '../offline/db';
import type { SyncState } from '../offline/replay';

let mockSync: SyncState;
let mockOps: OutboxOp[] = [];

vi.mock('../hooks/useCurrentUser', () => ({
  useCurrentUser: () => ({
    user: { id: 'u1', name: 'Ana Soto', email: 'ana@smi.cl', role: 'MANTENEDOR', image: null },
  }),
}));
vi.mock('../offline/replay', () => ({
  useSyncState: () => mockSync,
  requestSync: vi.fn(),
}));
vi.mock('../offline/useOutboxOps', () => ({ useOutboxOps: () => mockOps }));

const { prepararMock, usePrepareMock, logoutMock, countPendingMock } = vi.hoisted(() => ({
  prepararMock: vi.fn(),
  usePrepareMock: vi.fn(),
  logoutMock: vi.fn(),
  countPendingMock: vi.fn(),
}));
vi.mock('../offline/outbox', () => ({
  retryOp: vi.fn(),
  discardOp: vi.fn(),
  overwriteOp: vi.fn(),
  countPending: countPendingMock,
}));
vi.mock('../components/notifications/NotificationBell', () => ({ NotificationBell: () => null }));
vi.mock('../lib/logout', () => ({ logout: logoutMock }));
vi.mock('../hooks/usePrepareOffline', () => ({ usePrepareOffline: usePrepareMock }));

import { Topbar } from './Topbar';

function sync(overrides: Partial<SyncState> = {}): SyncState {
  return {
    pendingCount: 0,
    attentionCount: 0,
    otherAccountCount: 0,
    syncing: false,
    authRequired: false,
    lastSyncAt: null,
    lastError: null,
    notice: null,
    ...overrides,
  };
}

function write(overrides: Partial<OutboxOp> = {}): OutboxOp {
  return {
    id: 'w-1',
    type: 'httpWrite',
    v: 1,
    userId: 'u1',
    endpoint: 'branch.create',
    params: {},
    body: { id: 'br-1', name: 'Faena Norte' },
    label: 'Nueva sucursal · Faena Norte',
    status: 'needs_attention',
    attempts: 1,
    lastError: { message: 'Ya existe una sucursal con ese nombre', status: 409 },
    seq: 1,
    createdAt: 1,
    updatedAt: 1,
    ...overrides,
  } as OutboxOp;
}

function renderTopbar() {
  return render(
    <MemoryRouter>
      <Topbar />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  mockSync = sync();
  mockOps = [];
  usePrepareMock.mockReturnValue({ preparando: false, resultadoPrep: null, handlePreparar: prepararMock });
  logoutMock.mockResolvedValue(undefined);
  countPendingMock.mockResolvedValue(0);
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('Topbar — badge de sincronización', () => {
  it('está oculto cuando no hay nada pendiente', () => {
    renderTopbar();

    expect(screen.queryByRole('button', { name: /Sincronización:/ })).toBeNull();
  });

  it('aparece con el total de lo que espera', () => {
    mockSync = sync({ pendingCount: 2 });

    renderTopbar();

    expect(screen.getByRole('button', { name: 'Sincronización: 2 cambios sin sincronizar' })).toBeTruthy();
  });

  it('al tocarlo abre la hoja con lo que requiere atención y el "Preparar para uso sin señal" del rol', () => {
    mockSync = sync({ pendingCount: 1, attentionCount: 1 });
    mockOps = [write()];

    renderTopbar();
    fireEvent.click(screen.getByRole('button', { name: /Sincronización: 2 cambios/ }));

    expect(screen.getByRole('dialog', { name: 'Registros sin señal' })).toBeTruthy();
    expect(screen.getByText('Nueva sucursal · Faena Norte')).toBeTruthy();
    expect(screen.getByText('Ya existe una sucursal con ese nombre')).toBeTruthy();
    expect(usePrepareMock).toHaveBeenCalledWith('MANTENEDOR');

    fireEvent.click(screen.getByRole('button', { name: 'Preparar para uso sin señal' }));
    expect(prepararMock).toHaveBeenCalledTimes(1);
  });

  it('se cierra desde la hoja', () => {
    mockSync = sync({ pendingCount: 1 });

    renderTopbar();
    fireEvent.click(screen.getByRole('button', { name: /Sincronización:/ }));
    fireEvent.click(screen.getAllByRole('button', { name: 'Cerrar' })[0]!);

    expect(screen.queryByRole('dialog', { name: 'Registros sin señal' })).toBeNull();
  });
});

describe('Topbar — cerrar sesión', () => {
  async function pedirCerrarSesion() {
    fireEvent.click(screen.getByRole('button', { name: 'Menú de usuario' }));
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Cerrar sesión' }));
  }

  it('sin registros pendientes cierra sesión directo', async () => {
    renderTopbar();

    await pedirCerrarSesion();

    await waitFor(() => expect(logoutMock).toHaveBeenCalledTimes(1));
    expect(countPendingMock).toHaveBeenCalledWith('u1');
    expect(screen.queryByRole('alertdialog')).toBeNull();
  });

  it('con registros pendientes pide confirmación explícita y no cierra hasta confirmar', async () => {
    countPendingMock.mockResolvedValue(3);
    renderTopbar();

    await pedirCerrarSesion();

    const dialogo = await screen.findByRole('alertdialog');
    expect(dialogo.textContent).toContain('Hay 3 registros sin enviar');
    expect(dialogo.textContent).toContain('se enviarán cuando vuelvas a iniciar sesión en este equipo');
    expect(logoutMock).not.toHaveBeenCalled();

    fireEvent.click(within(dialogo).getByRole('button', { name: 'Cerrar sesión' }));
    await waitFor(() => expect(logoutMock).toHaveBeenCalledTimes(1));
  });

  it('cancelar la confirmación deja la sesión abierta', async () => {
    countPendingMock.mockResolvedValue(1);
    renderTopbar();

    await pedirCerrarSesion();
    fireEvent.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Cancelar' }));

    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
    expect(logoutMock).not.toHaveBeenCalled();
  });
});
