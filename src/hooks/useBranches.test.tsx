import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const { listMock, getByIdMock } = vi.hoisted(() => ({
  listMock: vi.fn(),
  getByIdMock: vi.fn(),
}));

vi.mock('../api/BranchAPI', () => ({ BranchAPI: { list: listMock, getById: getByIdMock } }));

// Las escrituras van por la cola: se prueba lo que se encola (ver `test/office-write.ts`).
vi.mock('../offline/submit-write', async (importOriginal) =>
  (await import('../test/office-write')).conSubmitWriteFalso(await importOriginal()),
);

// El hook llama a `toast.success`/`toast.danger` — no importa la UI real de
// HeroUI acá, solo que la función exista y no reviente el test.
vi.mock('@heroui/react', () => ({
  toast: { success: vi.fn(), danger: vi.fn() },
}));

import { toast } from '@heroui/react';
import { DomainError } from '../lib/api-error';
import { encolado, enviado, submitWriteMock, ultimaEscritura } from '../test/office-write';
import type { Branch } from '../types/branch';
import { useBranch, useBranches, useCreateBranch, useDeleteBranch, useUpdateBranch } from './useBranches';

afterEach(() => {
  cleanup();
  vi.resetAllMocks();
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

const SUCURSAL = BRANCH as unknown as Branch;

function wrapperNuevo() {
  return withQueryClient(new QueryClient());
}

describe('useCreateBranch', () => {
  it('encola branch.create con el id del cliente', async () => {
    submitWriteMock.mockResolvedValueOnce(enviado(SUCURSAL));
    const { result } = renderHook(() => useCreateBranch(), { wrapper: wrapperNuevo() });

    result.current.mutate({ name: 'Sucursal Centro', address: 'Av. 1' });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const { endpoint, input } = ultimaEscritura();
    expect(endpoint).toBe('branch.create');
    expect(input).toMatchObject({
      params: {},
      body: { name: 'Sucursal Centro', address: 'Av. 1', id: expect.stringMatching(/^[0-9a-f-]{36}$/) },
    });
    expect(toast.success).toHaveBeenCalledWith('Sucursal creada', { description: 'Sucursal Centro' });
  });

  it('en cola, el toast es el genérico (no hay respuesta del servidor que leer)', async () => {
    submitWriteMock.mockResolvedValueOnce(encolado());
    const { result } = renderHook(() => useCreateBranch(), { wrapper: wrapperNuevo() });

    result.current.mutate({ name: 'Sucursal Centro' });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(toast.success).toHaveBeenCalledWith(expect.stringContaining('Guardado'));
  });

  it('un 409 sin code (nombre repetido) muestra el mensaje del servidor', async () => {
    submitWriteMock.mockRejectedValueOnce(new DomainError('Ya existe una sucursal con ese nombre', { status: 409 }));
    const { result } = renderHook(() => useCreateBranch(), { wrapper: wrapperNuevo() });

    result.current.mutate({ name: 'Sucursal Centro' });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(toast.danger).toHaveBeenCalledWith('Ya existe una sucursal con ese nombre');
  });
});

describe('useUpdateBranch', () => {
  it('manda solo lo tocado con su valor base', async () => {
    submitWriteMock.mockResolvedValueOnce(enviado(SUCURSAL));
    const { result } = renderHook(() => useUpdateBranch(), { wrapper: wrapperNuevo() });

    result.current.mutate({ branch: SUCURSAL, input: { name: 'Casa Matriz', isActive: true } });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(ultimaEscritura()).toMatchObject({
      endpoint: 'branch.update',
      input: { params: { id: 'br_1' }, body: { name: 'Casa Matriz' }, expected: { name: 'Sucursal Centro' } },
    });
  });

  it('sin cambios no encola nada', async () => {
    const { result } = renderHook(() => useUpdateBranch(), { wrapper: wrapperNuevo() });

    result.current.mutate({ branch: SUCURSAL, input: { name: 'Sucursal Centro', isActive: true } });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(submitWriteMock).not.toHaveBeenCalled();
  });
});

describe('useDeleteBranch', () => {
  it('encola branch.delete con el id', async () => {
    submitWriteMock.mockResolvedValueOnce(enviado(true));
    const { result } = renderHook(() => useDeleteBranch(), { wrapper: wrapperNuevo() });

    result.current.mutate('br_1');

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(ultimaEscritura()).toMatchObject({ endpoint: 'branch.delete', input: { params: { id: 'br_1' } } });
    expect(toast.success).toHaveBeenCalledWith('Sucursal eliminada');
  });
});
