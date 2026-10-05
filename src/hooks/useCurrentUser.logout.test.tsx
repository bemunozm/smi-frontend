import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';

vi.mock('../config/env', () => ({ env: { apiUrl: 'http://api.test' } }));

import { useCurrentUser } from './useCurrentUser';
import { refreshSession } from '../lib/auth-client';
import { isSessionClosed, isServerSignOutPending } from '../lib/pending-signout';
import { logout } from '../lib/logout';
import { revokePendingSignOut, signInWithEmail } from '../lib/server-signout';
import { readSessionSnapshot } from '../lib/session-snapshot';

/** El servidor "recuerda" a este usuario aunque el cliente ya haya salido: es el estado
 * de Better Auth en memoria que reabría la sesión de quien se fue. */
let usuarioDelServidor: 'u1' | 'u2';
let signOutResponde: boolean;
let hayRed: boolean;

function usuario(id: string) {
  const now = new Date().toISOString();
  return {
    session: { id: `s-${id}`, userId: id, token: 't', expiresAt: now, createdAt: now, updatedAt: now },
    user: { id, name: `Usuario ${id}`, email: `${id}@smi.cl`, emailVerified: true, image: null, role: 'SUPERVISOR', createdAt: now, updatedAt: now },
  };
}

function json(body: unknown): Response {
  return new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } });
}

const fetchMock = vi.fn(async (input: RequestInfo | URL): Promise<Response> => {
  const url = input instanceof Request ? input.url : String(input);
  if (!hayRed) throw new TypeError('Failed to fetch');
  if (url.includes('/sign-out')) {
    if (!signOutResponde) throw new TypeError('Failed to fetch');
    return json({ success: true });
  }
  if (url.includes('/sign-in/email')) return json({ ...usuario(usuarioDelServidor), redirect: false });
  return json(usuario(usuarioDelServidor));
});

beforeEach(() => {
  window.localStorage.clear();
  usuarioDelServidor = 'u1';
  signOutResponde = true;
  hayRed = true;
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

async function entrarComoU1() {
  const montado = renderHook(() => useCurrentUser());
  // El estado de Better Auth es global al módulo: se le pide la sesión de este test.
  refreshSession();
  await waitFor(() => expect(montado.result.current.user?.id).toBe('u1'));
  await waitFor(() => expect(readSessionSnapshot()?.userId).toBe('u1'));
  return montado;
}

describe('después de salir, el snapshot no vuelve a escribirse', () => {
  it('con señal: al montar /login con el hook (Better Auth todavía tiene al usuario) el snapshot sigue borrado', async () => {
    const sesion = await entrarComoU1();
    const navigate = vi.fn();

    await act(async () => {
      await logout(navigate);
    });
    sesion.unmount();
    // /login monta GuestRoute: usa el hook mientras la sesión en memoria sigue siendo u1.
    const login = renderHook(() => useCurrentUser());
    await new Promise((resolve) => setTimeout(resolve, 60));

    expect(isSessionClosed()).toBe(true);
    expect(readSessionSnapshot()).toBeNull();
    expect(login.result.current).toMatchObject({ user: null, isAuthenticated: false, isOfflineSnapshot: false });
  });

  it('sin señal (cierre diferido): vuelve la señal, se borra la marca y recargar sin red NO abre ninguna sesión', async () => {
    const sesion = await entrarComoU1();
    hayRed = false;

    await act(async () => {
      await logout(vi.fn());
    });
    sesion.unmount();
    expect(isServerSignOutPending()).toBe(true);
    const enLogin = renderHook(() => useCurrentUser());
    await new Promise((resolve) => setTimeout(resolve, 60));
    expect(readSessionSnapshot()).toBeNull();
    expect(enLogin.result.current.isAuthenticated).toBe(false);
    enLogin.unmount();

    // Vuelve la señal: el servidor revoca la cookie y la marca pasa de "pendiente" a "cerrada".
    hayRed = true;
    expect(await revokePendingSignOut()).toBe(true);
    expect(isServerSignOutPending()).toBe(false);
    expect(isSessionClosed()).toBe(true);

    // Recarga sin señal: no hay snapshot que reabra a la persona que salió.
    hayRed = false;
    const recarga = renderHook(() => useCurrentUser());
    await new Promise((resolve) => setTimeout(resolve, 60));

    expect(readSessionSnapshot()).toBeNull();
    expect(recarga.result.current).toMatchObject({ user: null, isAuthenticated: false, isOfflineSnapshot: false });
  });

  it('un inicio de sesión exitoso después vuelve a escribir el snapshot, ahora del usuario nuevo', async () => {
    const sesion = await entrarComoU1();
    await act(async () => {
      await logout(vi.fn());
    });
    sesion.unmount();
    expect(readSessionSnapshot()).toBeNull();

    usuarioDelServidor = 'u2';
    const login = renderHook(() => useCurrentUser());
    await act(async () => {
      const { error } = await signInWithEmail({ email: 'u2@smi.cl', password: 'x' });
      expect(error).toBeNull();
    });

    expect(isSessionClosed()).toBe(false);
    await waitFor(() => expect(login.result.current.user?.id).toBe('u2'));
    await waitFor(() => expect(readSessionSnapshot()?.userId).toBe('u2'));
  });
});
