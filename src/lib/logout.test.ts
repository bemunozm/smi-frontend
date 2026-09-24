import { afterEach, describe, expect, it, vi } from 'vitest';

import { logout } from './logout';

// Mismo criterio que `UploadsAPI.test.ts`: `vi.hoisted` porque `vi.mock` se
// "hoistea" arriba de los imports.
const { signOutMock, clearMock } = vi.hoisted(() => ({
  signOutMock: vi.fn(),
  clearMock: vi.fn(),
}));

vi.mock('./auth-client', () => ({
  signOut: (...args: unknown[]) => signOutMock(...args),
}));

vi.mock('./query-client', () => ({
  queryClient: { clear: (...args: unknown[]) => clearMock(...args) },
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
      .mockResolvedValue(['smi-signed-files', 'smi-api', 'smi-uploads', 'workbox-precache-v2-https://smi.cl/']);
    vi.stubGlobal('caches', { keys: keysMock, delete: deleteMock });
    const navigate = vi.fn();

    await logout(navigate);

    expect(deleteMock).toHaveBeenCalledTimes(3);
    expect(deleteMock).toHaveBeenCalledWith('smi-signed-files');
    expect(deleteMock).toHaveBeenCalledWith('smi-api');
    expect(deleteMock).toHaveBeenCalledWith('smi-uploads');
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
});
