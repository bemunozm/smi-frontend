import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const { listMock, getByIdMock, createMock } = vi.hoisted(() => ({
  listMock: vi.fn(),
  getByIdMock: vi.fn(),
  createMock: vi.fn(),
}));

vi.mock('../api/BranchAPI', () => ({
  BranchAPI: {
    list: listMock,
    getById: getByIdMock,
    create: createMock,
    update: vi.fn(),
    remove: vi.fn(),
  },
}));

// El hook llama a `toast.success`/`toast.danger` — no importa la UI real de
// HeroUI acá, solo que la función exista y no reviente el test.
vi.mock('@heroui/react', () => ({
  toast: { success: vi.fn(), danger: vi.fn() },
}));

import { useBranch, useBranches, useCreateBranch } from './useBranches';

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const BRANCH = {
  id: 'br_1',
  name: 'Sucursal Centro',
  address: null,
  isActive: true,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

function withQueryClient(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

describe('useBranches', () => {
  it('sin filtros, cachea bajo la queryKey retrocompatible ["branches"]', async () => {
    listMock.mockResolvedValueOnce([BRANCH]);
    const queryClient = new QueryClient();

    const { result } = renderHook(() => useBranches(), { wrapper: withQueryClient(queryClient) });

    await waitFor(() => expect(result.current.data).toEqual([BRANCH]));
    expect(listMock).toHaveBeenCalledWith({});
    expect(queryClient.getQueryData(['branches'])).toEqual([BRANCH]);
  });

  it('con `isActive`, cachea bajo una queryKey distinta que incluye el filtro', async () => {
    listMock.mockResolvedValue([BRANCH]);
    const queryClient = new QueryClient();

    const { result } = renderHook(() => useBranches({ isActive: true }), {
      wrapper: withQueryClient(queryClient),
    });

    await waitFor(() => expect(result.current.data).toEqual([BRANCH]));
    expect(listMock).toHaveBeenCalledWith({ isActive: true });
    expect(queryClient.getQueryData(['branches'])).toBeUndefined();
    expect(queryClient.getQueryData(['branches', { isActive: true }])).toEqual([BRANCH]);
  });
});

describe('useBranch', () => {
  it('no dispara la query cuando el id viene vacío', () => {
    const queryClient = new QueryClient();

    const { result } = renderHook(() => useBranch(''), { wrapper: withQueryClient(queryClient) });

    expect(result.current.fetchStatus).toBe('idle');
    expect(getByIdMock).not.toHaveBeenCalled();
  });

  it('pide la sucursal cuando el id viene informado', async () => {
    getByIdMock.mockResolvedValueOnce(BRANCH);
    const queryClient = new QueryClient();

    const { result } = renderHook(() => useBranch('br_1'), { wrapper: withQueryClient(queryClient) });

    await waitFor(() => expect(result.current.data).toEqual(BRANCH));
    expect(getByIdMock).toHaveBeenCalledWith('br_1');
  });
});

describe('useCreateBranch', () => {
  it('invalida el árbol ["branches"] al crear', async () => {
    createMock.mockResolvedValueOnce(BRANCH);
    const queryClient = new QueryClient();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(() => useCreateBranch(), { wrapper: withQueryClient(queryClient) });

    result.current.mutate({ name: 'Sucursal Centro' });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['branches'] });
  });
});
