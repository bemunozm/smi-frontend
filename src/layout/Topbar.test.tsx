import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
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
vi.mock('../offline/outbox', () => ({ retryOp: vi.fn(), discardOp: vi.fn(), overwriteOp: vi.fn() }));
vi.mock('../components/notifications/NotificationBell', () => ({ NotificationBell: () => null }));
vi.mock('../lib/logout', () => ({ logout: vi.fn(), LogoutBlockedError: class extends Error {} }));

const { prepararMock, usePrepareMock } = vi.hoisted(() => ({
  prepararMock: vi.fn(),
  usePrepareMock: vi.fn(),
}));
vi.mock('../hooks/usePrepareOffline', () => ({ usePrepareOffline: usePrepareMock }));

import { Topbar } from './Topbar';

function sync(overrides: Partial<SyncState> = {}): SyncState {
  return {
    pendingCount: 0,
    attentionCount: 0,
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

    expect(screen.getByRole('dialog', { name: 'Sincronización' })).toBeTruthy();
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

    expect(screen.queryByRole('dialog', { name: 'Sincronización' })).toBeNull();
  });
});
