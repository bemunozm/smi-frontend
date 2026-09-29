import { afterEach, describe, expect, it, vi } from 'vitest';

import { logout, LogoutBlockedError } from './logout';

// Mismo criterio que `UploadsAPI.test.ts`: `vi.hoisted` porque `vi.mock` se
// "hoistea" arriba de los imports.
const { signOutMock, clearMock, countPendingMock } = vi.hoisted(() => ({
  signOutMock: vi.fn(),
  clearMock: vi.fn(),
  countPendingMock: vi.fn().mockResolvedValue(0),
}));

vi.mock('./auth-client', () => ({
  signOut: (...args: unknown[]) => signOutMock(...args),
}));

vi.mock('./query-client', () => ({
  queryClient: { clear: (...args: unknown[]) => clearMock(...args) },
}));

// `offline/outbox.ts` importa Dexie (`offline/db.ts`) — se mockea entero acá
// (no `fake-indexeddb`) porque este archivo solo necesita controlar el
// NÚMERO que ve el candado del logout, no ejercitar Dexie de verdad.
vi.mock('../offline/outbox', () => ({
  countPending: (...args: unknown[]) => countPendingMock(...args),
}));

afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

describe('logout', () => {
  it('cierra sesión, limpia TanStack Query y navega a /login (sin Cache Storage disponible)', async () => {
    // jsdom no implementa Cache Storage — `'caches' in window` es `false` acá
    // sin necesidad de stubear nada, así que este caso ejercita esa rama.
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

  it('si Cache Storage no existe (`caches` no está en window), igual navega', async () => {
    signOutMock.mockResolvedValue(undefined);
    const navigate = vi.fn();

    await logout(navigate);

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

  /**
   * RFC "Supervisión en Terreno" §Diseño → Offline: "logout()
   * no borra el outbox y bloquea si hay pendientes". El candado se revisa
   * ANTES de `signOut()` — nada de la sesión se toca si el logout se bloquea.
   */
  describe('candado de operaciones sin sincronizar', () => {
    it('sin userId (sesiones sin outbox, ej. ADMIN/MANTENEDOR), ni siquiera consulta countPending', async () => {
      signOutMock.mockResolvedValue(undefined);
      const navigate = vi.fn();

      await logout(navigate);

      expect(countPendingMock).not.toHaveBeenCalled();
      expect(signOutMock).toHaveBeenCalledTimes(1);
    });

    it('con userId y 0 pendientes, el logout sigue normal', async () => {
      signOutMock.mockResolvedValue(undefined);
      countPendingMock.mockResolvedValueOnce(0);
      const navigate = vi.fn();

      await logout(navigate, 'u1');

      expect(countPendingMock).toHaveBeenCalledWith('u1');
      expect(signOutMock).toHaveBeenCalledTimes(1);
      expect(navigate).toHaveBeenCalledWith('/login', { replace: true });
    });

    it('con operaciones pendientes, lanza LogoutBlockedError y NUNCA llega a signOut/clear/navigate', async () => {
      countPendingMock.mockResolvedValueOnce(3);
      const navigate = vi.fn();

      await expect(logout(navigate, 'u1')).rejects.toBeInstanceOf(LogoutBlockedError);

      expect(signOutMock).not.toHaveBeenCalled();
      expect(clearMock).not.toHaveBeenCalled();
      expect(navigate).not.toHaveBeenCalled();
    });

    it('el mensaje de LogoutBlockedError trae el número de pendientes', async () => {
      countPendingMock.mockResolvedValueOnce(2);

      const error = await logout(vi.fn(), 'u1').catch((e: unknown) => e);

      expect(error).toBeInstanceOf(LogoutBlockedError);
      expect((error as LogoutBlockedError).pendingCount).toBe(2);
      expect((error as LogoutBlockedError).message).toContain('2');
    });
  });
});
