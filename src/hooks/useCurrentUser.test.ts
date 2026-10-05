import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useCurrentUser } from './useCurrentUser';
import { readSessionSnapshot, saveSessionSnapshot } from '../lib/session-snapshot';
import { isCacheOwnerMismatch } from '../lib/cache-owner';
import { reconcileCacheOwner } from '../lib/session-data';
import { ROLES } from '../types/roles';

interface MockSession {
  data: unknown;
  isPending: boolean;
  error: unknown;
}

let mockSession: MockSession;

vi.mock('../lib/auth-client', () => ({
  useSession: () => mockSession,
}));

const SAVED_SNAPSHOT = {
  userId: 'u1',
  name: 'Juan Rojas',
  email: 'juan@smi.local',
  role: ROLES.SUPERVISOR,
  savedAt: 1_700_000_000_000,
};

beforeEach(() => {
  window.localStorage.clear();
  mockSession = { data: null, isPending: true, error: null };
});

afterEach(() => {
  vi.useRealTimers();
});

describe('useCurrentUser — sesión confirmada', () => {
  it('devuelve el usuario real y persiste el snapshot', () => {
    mockSession = {
      data: {
        user: { id: 'u1', name: 'Juan Rojas', email: 'juan@smi.local', role: ROLES.SUPERVISOR },
      },
      isPending: false,
      error: null,
    };

    const { result } = renderHook(() => useCurrentUser());

    expect(result.current.isAuthenticated).toBe(true);
    expect(result.current.isOfflineSnapshot).toBe(false);
    expect(result.current.role).toBe(ROLES.SUPERVISOR);
    expect(result.current.user?.name).toBe('Juan Rojas');
    expect(readSessionSnapshot()).toMatchObject({
      userId: 'u1',
      name: 'Juan Rojas',
      email: 'juan@smi.local',
      role: ROLES.SUPERVISOR,
    });
  });
});

describe('useCurrentUser — fallback offline (error de red)', () => {
  it('con error de red (sin status HTTP) y snapshot guardado, cae al usuario offline', () => {
    saveSessionSnapshot(SAVED_SNAPSHOT);
    mockSession = { data: null, isPending: false, error: new TypeError('Failed to fetch') };

    const { result } = renderHook(() => useCurrentUser());

    expect(result.current.isAuthenticated).toBe(true);
    expect(result.current.isOfflineSnapshot).toBe(true);
    expect(result.current.isPending).toBe(false);
    expect(result.current.role).toBe(ROLES.SUPERVISOR);
    expect(result.current.user?.name).toBe('Juan Rojas');
    expect(result.current.user?.email).toBe('juan@smi.local');
  });

  it('sin snapshot guardado, un error de red deja al usuario sin sesión (rebota a /login)', () => {
    mockSession = { data: null, isPending: false, error: new TypeError('Failed to fetch') };

    const { result } = renderHook(() => useCurrentUser());

    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.isOfflineSnapshot).toBe(false);
    expect(result.current.user).toBeNull();
  });

  it('un error CON status HTTP (ej. 500) no activa el fallback offline', () => {
    saveSessionSnapshot(SAVED_SNAPSHOT);
    mockSession = { data: null, isPending: false, error: { status: 500, statusText: 'Internal Server Error' } };

    const { result } = renderHook(() => useCurrentUser());

    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.isOfflineSnapshot).toBe(false);
  });

  it('un 401 real limpia el snapshot (ya no sirve de fallback)', () => {
    saveSessionSnapshot(SAVED_SNAPSHOT);
    mockSession = { data: null, isPending: false, error: { status: 401, statusText: 'Unauthorized' } };

    renderHook(() => useCurrentUser());

    expect(readSessionSnapshot()).toBeNull();
  });

  it('un 401 real anota que la sesión terminó: el próximo inicio purga las cachés, aun siendo la misma persona', () => {
    reconcileCacheOwner('u1');
    mockSession = { data: null, isPending: false, error: { status: 401, statusText: 'Unauthorized' } };

    renderHook(() => useCurrentUser());

    expect(isCacheOwnerMismatch('u1')).toBe(true);
  });

  it('un error de red no anota nada', () => {
    reconcileCacheOwner('u1');
    mockSession = { data: null, isPending: false, error: new TypeError('Failed to fetch') };

    renderHook(() => useCurrentUser());

    expect(isCacheOwnerMismatch('u1')).toBe(false);
  });
});

describe('useCurrentUser — fallback offline (pending > 4s)', () => {
  it('con `isPending` sostenido más de 4s y snapshot guardado, cae al usuario offline', () => {
    vi.useFakeTimers();
    saveSessionSnapshot(SAVED_SNAPSHOT);
    mockSession = { data: null, isPending: true, error: null };

    const { result } = renderHook(() => useCurrentUser());

    // Recién montado: todavía dentro de la ventana de espera, sin fallback.
    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.isPending).toBe(true);

    act(() => {
      vi.advanceTimersByTime(4000);
    });

    expect(result.current.isAuthenticated).toBe(true);
    expect(result.current.isOfflineSnapshot).toBe(true);
    expect(result.current.isPending).toBe(false);
  });

  it('sin snapshot, sigue pendiente después de 4s (no hay nada que ofrecer offline)', () => {
    vi.useFakeTimers();
    mockSession = { data: null, isPending: true, error: null };

    const { result } = renderHook(() => useCurrentUser());

    act(() => {
      vi.advanceTimersByTime(4000);
    });

    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.isOfflineSnapshot).toBe(false);
    expect(result.current.isPending).toBe(true);
  });

  it('antes de los 4s no cae al fallback aunque haya snapshot (le da tiempo a la red)', () => {
    vi.useFakeTimers();
    saveSessionSnapshot(SAVED_SNAPSHOT);
    mockSession = { data: null, isPending: true, error: null };

    const { result } = renderHook(() => useCurrentUser());

    act(() => {
      vi.advanceTimersByTime(3000);
    });

    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.isOfflineSnapshot).toBe(false);
  });
});
