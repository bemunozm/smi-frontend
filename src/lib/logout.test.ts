import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { logout } from './logout';
import { db } from '../offline/db';
import { isServerSignOutPending } from './pending-signout';

// `vi.hoisted` porque `vi.mock` se "hoistea" arriba de los imports.
const { signOutMock, clearMock, cancelMock } = vi.hoisted(() => ({
  signOutMock: vi.fn(),
  clearMock: vi.fn(),
  cancelMock: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('./auth-client', () => ({
  signOut: (...args: unknown[]) => signOutMock(...args),
}));

vi.mock('./query-client', () => ({
  queryClient: {
    clear: (...args: unknown[]) => clearMock(...args),
    cancelQueries: () => cancelMock(),
  },
}));

beforeEach(async () => {
  await db.outbox.clear();
  window.localStorage.clear();
});

afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

describe('logout', () => {
  it('cierra sesión, limpia TanStack Query y navega a /login (sin Cache Storage disponible)', async () => {
    // jsdom no implementa Cache Storage — `caches` no existe acá sin necesidad
    // de stubear nada, así que este caso ejercita esa rama.
    signOutMock.mockResolvedValue(undefined);
    const navigate = vi.fn();

    await logout(navigate);

    expect(signOutMock).toHaveBeenCalledTimes(1);
    expect(clearMock).toHaveBeenCalledTimes(1);
    expect(navigate).toHaveBeenCalledWith('/login', { replace: true });
  });

  it('espera signOut antes de limpiar el estado local (invalida la cookie primero)', async () => {
    let signOutResolved = false;
    signOutMock.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          setTimeout(() => {
            signOutResolved = true;
            resolve();
          }, 0);
        }),
    );
    const navigate = vi.fn();

    const promise = logout(navigate);
    expect(clearMock).not.toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();

    await promise;

    expect(signOutResolved).toBe(true);
    expect(clearMock).toHaveBeenCalledTimes(1);
  });

  it('borra solo los Cache Storage con prefijo smi-, conservando el precache de Workbox', async () => {
    signOutMock.mockResolvedValue(undefined);
    const deleteMock = vi.fn().mockResolvedValue(true);
    const keysMock = vi
      .fn()
      .mockResolvedValue(['smi-signed-files', 'smi-api', 'smi-example', 'workbox-precache-v2-https://smi.cl/']);
    vi.stubGlobal('caches', { keys: keysMock, delete: deleteMock });
    const navigate = vi.fn();

    await logout(navigate);

    expect(deleteMock).toHaveBeenCalledTimes(3);
    expect(deleteMock).toHaveBeenCalledWith('smi-signed-files');
    expect(deleteMock).toHaveBeenCalledWith('smi-api');
    expect(deleteMock).toHaveBeenCalledWith('smi-example');
    expect(deleteMock).not.toHaveBeenCalledWith('workbox-precache-v2-https://smi.cl/');
    expect(navigate).toHaveBeenCalledWith('/login', { replace: true });
  });

  it('si Cache Storage falla (cuota, navegación privada), el logout sigue adelante y navega igual', async () => {
    signOutMock.mockResolvedValue(undefined);
    vi.stubGlobal('caches', {
      keys: vi.fn().mockRejectedValue(new Error('quota exceeded')),
      delete: vi.fn(),
    });
    const navigate = vi.fn();
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    await logout(navigate);

    expect(clearMock).toHaveBeenCalledTimes(1);
    expect(navigate).toHaveBeenCalledWith('/login', { replace: true });

    consoleErrorSpy.mockRestore();
  });

  it('las cachés quedan sin dueño: la próxima sesión las adopta sin purgar otra vez', async () => {
    signOutMock.mockResolvedValue(undefined);
    window.localStorage.setItem('smi-cache-owner', JSON.stringify('u1'));

    await logout(vi.fn());

    expect(window.localStorage.getItem('smi-cache-owner')).toBeNull();
  });

  it('cancela las queries en vuelo antes de cerrar la sesión en el servidor', async () => {
    const orden: string[] = [];
    cancelMock.mockImplementation(async () => {
      orden.push('cancel');
    });
    signOutMock.mockImplementation(async () => {
      orden.push('signOut');
    });

    await logout(vi.fn());

    expect(orden.slice(0, 2)).toEqual(['cancel', 'signOut']);
  });

  describe('sin señal (signOut no llega al servidor)', () => {
    it.each([
      ['lanza', () => signOutMock.mockRejectedValue(new TypeError('Failed to fetch'))],
      ['devuelve un error sin respuesta', () => signOutMock.mockResolvedValue({ data: null, error: { status: 0 } })],
    ])('%s: cierra igual en el equipo, deja la marca de cierre pendiente y va al login', async (_caso, preparar) => {
      preparar();
      window.localStorage.setItem('smi-cache-owner', JSON.stringify('u1'));
      window.localStorage.setItem('smi-session-snapshot', JSON.stringify({ userId: 'u1' }));
      const navigate = vi.fn();

      await logout(navigate);

      expect(isServerSignOutPending()).toBe(true);
      expect(clearMock).toHaveBeenCalledTimes(1);
      expect(window.localStorage.getItem('smi-session-snapshot')).toBeNull();
      expect(window.localStorage.getItem('smi-cache-owner')).toBeNull();
      expect(navigate).toHaveBeenCalledWith('/login', { replace: true });
    });

    it('un 401 del servidor (ya no había sesión) cuenta como cerrado: sin marca', async () => {
      signOutMock.mockResolvedValue({ data: null, error: { status: 401 } });

      await logout(vi.fn());

      expect(isServerSignOutPending()).toBe(false);
    });

    it('la cola sigue intacta', async () => {
      signOutMock.mockRejectedValue(new TypeError('Failed to fetch'));
      const now = Date.now();
      await db.outbox.put({
        id: 'op-1', type: 'sendExitReport', v: 1, userId: 'u1', status: 'pending', attempts: 0, seq: now,
        createdAt: now, updatedAt: now, payload: { id: 'op-1', cardIds: [] },
      } as never);

      await logout(vi.fn());

      expect(await db.outbox.count()).toBe(1);
    });
  });

  it('con registros sin enviar, cierra sesión igual y NO toca la cola del equipo', async () => {
    signOutMock.mockResolvedValue(undefined);
    const now = Date.now();
    await db.outbox.put({
      id: 'op-1',
      type: 'sendExitReport',
      v: 1,
      userId: 'u1',
      status: 'pending',
      attempts: 0,
      seq: now,
      createdAt: now,
      updatedAt: now,
      payload: { id: 'op-1', shiftDate: '2026-10-05', shiftType: 'DIURNO', cardIds: [], requestedAt: 't' },
    } as never);
    const navigate = vi.fn();

    await logout(navigate);

    expect(signOutMock).toHaveBeenCalledTimes(1);
    expect(navigate).toHaveBeenCalledWith('/login', { replace: true });
    expect(await db.outbox.count()).toBe(1);
  });
});
