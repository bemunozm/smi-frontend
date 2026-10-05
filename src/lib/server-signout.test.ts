import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';

vi.mock('../config/env', () => ({ env: { apiUrl: 'http://api.test' } }));

import { authClient } from './auth-client';
import { clearServerSignOutPending, clearSessionClosed, isServerSignOutPending, markServerSignOutPending, useSessionClosed } from './pending-signout';
import { revokePendingSignOut, signInWithEmail, startSignOutRevocation } from './server-signout';

const fetchMock = vi.fn();

function llamadas(): string[] {
  return fetchMock.mock.calls.map(([input]) => (input instanceof Request ? input.url : String(input)));
}

function respuesta(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

beforeEach(() => {
  window.localStorage.clear();
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('cierre de sesión pendiente en el servidor', () => {
  it('con la marca puesta, get-session no se manda: responde "sin sesión" localmente', async () => {
    markServerSignOutPending();

    const resultado = await authClient.getSession();

    expect(resultado.data).toBeNull();
    expect(llamadas().filter((url) => url.includes('/get-session'))).toEqual([]);
  });

  it('al arrancar, signOut va ANTES de get-session; con éxito se borra la marca', async () => {
    markServerSignOutPending();
    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      const url = input instanceof Request ? input.url : String(input);
      return url.includes('/sign-out') ? respuesta({ success: true }) : respuesta(null);
    });

    startSignOutRevocation();
    await vi.waitFor(() => expect(isServerSignOutPending()).toBe(false));
    await authClient.getSession();

    const urls = llamadas();
    expect(urls[0]).toContain('/sign-out');
    expect(urls.findIndex((u) => u.includes('/get-session'))).toBeGreaterThan(urls.findIndex((u) => u.includes('/sign-out')));
  });

  it('si signOut falla otra vez, la marca queda y sigue sin haber sesión', async () => {
    markServerSignOutPending();
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));

    expect(await revokePendingSignOut()).toBe(false);

    expect(isServerSignOutPending()).toBe(true);
    const sesion = await authClient.getSession();
    expect(sesion.data).toBeNull();
    expect(llamadas().filter((url) => url.includes('/get-session'))).toEqual([]);
  });

  it('al volver la señal (evento online) lo reintenta', async () => {
    startSignOutRevocation();
    markServerSignOutPending();
    fetchMock.mockResolvedValue(respuesta({ success: true }));

    window.dispatchEvent(new Event('online'));

    await vi.waitFor(() => expect(isServerSignOutPending()).toBe(false));
  });

  it('sin marca no hace nada', async () => {
    expect(await revokePendingSignOut()).toBe(true);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('la pantalla de login completa el cierre pendiente antes de dejar entrar a alguien', async () => {
    markServerSignOutPending();
    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      const url = input instanceof Request ? input.url : String(input);
      if (url.includes('/sign-out')) return respuesta({ success: true });
      return respuesta({ user: { id: 'u2' }, token: 't' });
    });

    await signInWithEmail({ email: 'a@b.cl', password: 'x' });

    const urls = llamadas();
    expect(urls[0]).toContain('/sign-out');
    expect(urls.some((u) => u.includes('/sign-in/email'))).toBe(true);
    expect(isServerSignOutPending()).toBe(false);
  });

  it('si no se puede completar el cierre, no se envía el login y se explica', async () => {
    markServerSignOutPending();
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));

    const { error } = await signInWithEmail({ email: 'a@b.cl', password: 'x' });

    expect(error?.message).toMatch(/Falta cerrar la sesión anterior/);
    expect(llamadas().some((u) => u.includes('/sign-in/email'))).toBe(false);
  });

  it('useSessionClosed sigue la marca en vivo', () => {
    const { result, rerender } = renderHook(() => useSessionClosed());
    expect(result.current).toBe(false);

    markServerSignOutPending();
    rerender();
    expect(result.current).toBe(true);

    clearServerSignOutPending();
    rerender();
    expect(result.current).toBe(true); // el servidor confirmó, pero la sesión sigue cerrada en el equipo

    clearSessionClosed();
    rerender();
    expect(result.current).toBe(false);
  });
});
