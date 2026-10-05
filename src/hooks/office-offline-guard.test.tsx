import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { QueryClientProvider, onlineManager } from '@tanstack/react-query';

/**
 * Los módulos de oficina NO tienen cola offline: sin señal, guardar tiene que
 * FALLAR RÁPIDO con un aviso honesto — no quedar en `isPending` para siempre
 * (el default `networkMode: 'online'` de TanStack pausa la mutación en
 * silencio). Se prueban 3 flujos representativos de punta a punta (hook →
 * `api/<X>API.ts` → `toDomainError` → toast) con el `queryClient` REAL de la
 * app, para ejercitar `mutations.networkMode` de `lib/query-client.ts`.
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
import { useUpdateEquipment } from './useEquipment';
import { useCreateMovement } from './useInventory';
import { useCreateOperator } from './useOperators';
import type { UpdateEquipmentInput } from '../types/equipment';
import type { InventoryItem } from '../types/inventory';

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

describe('oficina sin señal: la mutación falla rápido con el aviso de red', () => {
  it('Equipos: editar un equipo', async () => {
    patchMock.mockRejectedValueOnce(sinSenal('patch'));
    const { result } = renderHook(() => useUpdateEquipment(), { wrapper });

    act(() => {
      result.current.mutate({ id: 'eq_1', input: { type: 'Excavadora' } as UpdateEquipmentInput });
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.isPending).toBe(false);
    expect(patchMock).toHaveBeenCalledTimes(1);
    expect(toastDangerMock).toHaveBeenCalledWith(NETWORK_ERROR_MESSAGE);
  });

  it('Inventario: registrar un movimiento', async () => {
    postMock.mockRejectedValueOnce(sinSenal('post'));
    const { result } = renderHook(() => useCreateMovement(), { wrapper });

    act(() => {
      result.current.mutate({
        input: { itemId: 'it_1', branchId: 'br_1', direction: 'OUT', reason: 'ACTIVITY', quantity: 2 },
        item: { id: 'it_1', stocks: [], unit: 'UNIT' } as unknown as InventoryItem,
      });
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(toastDangerMock).toHaveBeenCalledWith(NETWORK_ERROR_MESSAGE);
  });

  it('Operadores: crear un operador', async () => {
    postMock.mockRejectedValueOnce(sinSenal('post'));
    const { result } = renderHook(() => useCreateOperator(), { wrapper });

    act(() => {
      result.current.mutate({ name: 'Rodrigo Paredes' });
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(toastDangerMock).toHaveBeenCalledWith(NETWORK_ERROR_MESSAGE);
  });

  it('un rechazo REAL del servidor sigue mostrando su propio mensaje, no el de red', async () => {
    postMock.mockRejectedValueOnce(
      Object.assign(new Error('Request failed'), {
        isAxiosError: true,
        config: { method: 'post' },
        response: { status: 409, data: { message: 'Ya existe un operador con ese RUT' } },
      }),
    );
    const { result } = renderHook(() => useCreateOperator(), { wrapper });

    act(() => {
      result.current.mutate({ name: 'Rodrigo Paredes' });
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(toastDangerMock).toHaveBeenCalledWith('Ya existe un operador con ese RUT');
  });
});
