import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('../offline/submit-write', async (importOriginal) =>
  (await import('../test/office-write')).conSubmitWriteFalso(await importOriginal()),
);
vi.mock('@heroui/react', () => ({
  toast: { success: vi.fn(), danger: vi.fn(), warning: vi.fn(), info: vi.fn() },
}));

import { toast } from '@heroui/react';
import { DomainError } from '../lib/api-error';
import { encolado, enviado, submitWriteMock, ultimaEscritura } from '../test/office-write';
import { useQueuedCreate, useQueuedDelete, useQueuedMutation } from './useQueuedMutation';

function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={new QueryClient()}>{children}</QueryClientProvider>;
}

afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});

describe('useQueuedMutation', () => {
  it('por defecto espera el resultado como oficina', async () => {
    submitWriteMock.mockResolvedValueOnce(enviado(true));
    const onSent = vi.fn();
    const { result } = renderHook(
      () =>
        useQueuedMutation<'category.delete', string>({
          endpoint: 'category.delete',
          build: (id) => ({ params: { id }, body: {} }),
          onSent,
          errorFallback: 'No se pudo',
        }),
      { wrapper },
    );

    result.current.mutate('c1');

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(ultimaEscritura().options.waitMs).toBeGreaterThan(0);
    expect(onSent).toHaveBeenCalledWith(true, 'c1');
  });

  it('con waitMs 0 y un usuario explícito guarda y vuelve (Terreno)', async () => {
    submitWriteMock.mockResolvedValueOnce(encolado());
    const { result } = renderHook(
      () =>
        useQueuedMutation<'category.delete', string>({
          endpoint: 'category.delete',
          waitMs: 0,
          userId: 'u9',
          build: (id) => ({ params: { id }, body: {} }),
          errorFallback: 'No se pudo',
        }),
      { wrapper },
    );

    result.current.mutate('c1');

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(ultimaEscritura().options).toEqual({ waitMs: 0, userId: 'u9' });
    expect(toast.success).toHaveBeenCalledWith(expect.stringContaining('Guardado'));
  });

  it('si build no tiene nada que mandar no escribe y avisa solo si el llamador lo pidió', async () => {
    const onUnchanged = vi.fn();
    const { result } = renderHook(
      () =>
        useQueuedMutation<'category.delete', string>({
          endpoint: 'category.delete',
          build: () => null,
          onUnchanged,
          errorFallback: 'No se pudo',
        }),
      { wrapper },
    );

    result.current.mutate('c1');

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(submitWriteMock).not.toHaveBeenCalled();
    expect(onUnchanged).toHaveBeenCalledWith('c1');
    expect(toast.success).not.toHaveBeenCalled();
  });

  it('un error de negocio sale con el mensaje del formulario, o con el que el llamador defina', async () => {
    submitWriteMock.mockRejectedValue(new DomainError('Tiene ítems', { status: 409 }));
    const { result } = renderHook(
      () =>
        useQueuedMutation<'category.delete', string>({
          endpoint: 'category.delete',
          build: (id) => ({ params: { id }, body: {} }),
          errorFallback: 'No se pudo',
          errorMessage: (error) => `Propio: ${error instanceof Error ? error.message : ''}`,
        }),
      { wrapper },
    );

    result.current.mutate('c1');

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(toast.danger).toHaveBeenCalledWith('Propio: Tiene ítems');
  });
});

describe('useQueuedCreate', () => {
  it('le da a build el id de la entidad, distinto en cada mutación', async () => {
    submitWriteMock.mockResolvedValue(encolado());
    const { result } = renderHook(
      () =>
        useQueuedCreate<'category.create', string>({
          endpoint: 'category.create',
          build: (name, id) => ({ params: {}, body: { name, id } }),
          errorFallback: 'No se pudo',
        }),
      { wrapper },
    );

    result.current.mutate('Filtros');
    await waitFor(() => expect(submitWriteMock).toHaveBeenCalledTimes(1));
    const primero = ultimaEscritura().input.body as { name: string; id: string };
    result.current.mutate('Filtros');
    await waitFor(() => expect(submitWriteMock).toHaveBeenCalledTimes(2));
    const segundo = ultimaEscritura().input.body as { name: string; id: string };

    expect(primero).toMatchObject({ name: 'Filtros', id: expect.stringMatching(/^[0-9a-f-]{36}$/) });
    expect(primero.id).not.toBe(segundo.id);
  });
});

describe('useQueuedDelete', () => {
  it('borra por id y confirma con el texto del dominio cuando el servidor responde', async () => {
    submitWriteMock.mockResolvedValueOnce(enviado(true));
    const { result } = renderHook(
      () => useQueuedDelete({ endpoint: 'category.delete', sentMessage: 'Categoría eliminada', errorFallback: 'No se pudo' }),
      { wrapper },
    );

    result.current.mutate('cat_1');

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(ultimaEscritura()).toMatchObject({ endpoint: 'category.delete', input: { params: { id: 'cat_1' }, body: {} } });
    expect(toast.success).toHaveBeenCalledWith('Categoría eliminada');
  });

  it('en cola avisa que quedó guardado, no que se eliminó', async () => {
    submitWriteMock.mockResolvedValueOnce(encolado());
    const { result } = renderHook(
      () => useQueuedDelete({ endpoint: 'category.delete', sentMessage: 'Categoría eliminada', errorFallback: 'No se pudo' }),
      { wrapper },
    );

    result.current.mutate('cat_1');

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(toast.success).toHaveBeenCalledWith(expect.stringContaining('Guardado'));
    expect(toast.success).not.toHaveBeenCalledWith('Categoría eliminada');
  });
});
