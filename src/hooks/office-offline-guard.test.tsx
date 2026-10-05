import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { QueryClientProvider, onlineManager } from '@tanstack/react-query';

/**
 * Lo que NUNCA se encola (ver `RUTAS_QUE_NUNCA_SE_ENCOLAN`, `offline/endpoints`):
 * sin señal, guardar tiene que FALLAR RÁPIDO con un aviso honesto — no quedar en
 * `isPending` para siempre (el default `networkMode: 'online'` de TanStack pausa
 * la mutación en silencio) ni guardarse en el equipo para aplicarse después con
 * otra sesión. Se prueban dos flujos representativos (usuarios y notificaciones)
 * de punta a punta (hook → `api/<X>API.ts` → `toDomainError` → toast) con el
 * `queryClient` REAL de la app, para ejercitar `mutations.networkMode` de
 * `lib/query-client.ts`.
 */
const { patchMock, postMock, toastDangerMock } = vi.hoisted(() => ({
  patchMock: vi.fn(),
  postMock: vi.fn(),
  toastDangerMock: vi.fn(),
}));

vi.mock('../lib/axios', () => ({ axiosInstance: { patch: patchMock, post: postMock, get: vi.fn() } }));
vi.mock('@heroui/react', () => ({
  toast: { success: vi.fn(), danger: toastDangerMock, warning: vi.fn() },
}));

import { queryClient } from '../lib/query-client';
import { NETWORK_ERROR_MESSAGE } from '../lib/api-error';
import { useMarkRead } from './useNotificaciones';
import { useCreateUser } from './useUsers';

/** Un `AxiosError` de una request que nunca recibió respuesta. */
function sinSenal(method: string): Error {
  return Object.assign(new Error('Network Error'), { isAxiosError: true, config: { method } });
}

function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

beforeEach(() => {
  onlineManager.setOnline(false);
});

afterEach(() => {
  onlineManager.setOnline(true);
  cleanup();
  vi.clearAllMocks();
  queryClient.clear();
});

describe('lo que no se encola, sin señal: la mutación falla rápido con el aviso de red', () => {
  it('Usuarios: crear un usuario (contraseñas y roles no se guardan para después)', async () => {
    postMock.mockRejectedValueOnce(sinSenal('post'));
    const { result } = renderHook(() => useCreateUser(), { wrapper });

    act(() => {
      result.current.mutate({ name: 'Ana', email: 'ana@smi.cl', password: 'secreta123', role: 'SUPERVISOR' });
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.isPending).toBe(false);
    expect(postMock).toHaveBeenCalledTimes(1);
    expect(toastDangerMock).toHaveBeenCalledWith(NETWORK_ERROR_MESSAGE);
  });

  it('Notificaciones: marcar leída', async () => {
    patchMock.mockRejectedValueOnce(sinSenal('patch'));
    const { result } = renderHook(() => useMarkRead(), { wrapper });

    act(() => {
      result.current.mutate('n_1');
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(patchMock).toHaveBeenCalledTimes(1);
    expect(toastDangerMock).toHaveBeenCalledWith(NETWORK_ERROR_MESSAGE);
  });

  it('un rechazo REAL del servidor sigue mostrando su propio mensaje, no el de red', async () => {
    postMock.mockRejectedValueOnce(
      Object.assign(new Error('Request failed'), {
        isAxiosError: true,
        config: { method: 'post' },
        response: { status: 409, data: { message: 'Ya existe un usuario con ese correo' } },
      }),
    );
    const { result } = renderHook(() => useCreateUser(), { wrapper });

    act(() => {
      result.current.mutate({ name: 'Ana', email: 'ana@smi.cl', password: 'secreta123', role: 'SUPERVISOR' });
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(toastDangerMock).toHaveBeenCalledWith('Ya existe un usuario con ese correo');
  });
});
