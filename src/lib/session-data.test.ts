import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { markSessionEnded, readCacheOwner } from './cache-owner';
import { DomainError } from './api-error';
import { queryClient } from './query-client';
import { purgeSessionData, reconcileCacheOwner } from './session-data';

beforeEach(() => {
  window.localStorage.clear();
  queryClient.clear();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('reconcileCacheOwner', () => {
  it('sin dueño registrado adopta al usuario sin borrar nada', () => {
    queryClient.setQueryData(['equipment'], [1]);

    expect(reconcileCacheOwner('u1')).toBe(false);

    expect(readCacheOwner()).toBe('u1');
    expect(queryClient.getQueryData(['equipment'])).toEqual([1]);
  });

  it('con el mismo dueño no purga', () => {
    reconcileCacheOwner('u1');
    queryClient.setQueryData(['equipment'], [1]);

    expect(reconcileCacheOwner('u1')).toBe(false);

    expect(queryClient.getQueryData(['equipment'])).toEqual([1]);
  });

  it('si entra OTRO usuario purga TanStack y los caches smi- (smi-api y los archivos firmados) y le deja las cachés', async () => {
    reconcileCacheOwner('u1');
    queryClient.setQueryData(['equipment'], [1]);
    const deleteMock = vi.fn().mockResolvedValue(true);
    vi.stubGlobal('caches', {
      keys: vi.fn().mockResolvedValue(['smi-api', 'smi-signed-files', 'workbox-precache-v2-x']),
      delete: deleteMock,
    });

    expect(reconcileCacheOwner('u2')).toBe(true);

    expect(queryClient.getQueryData(['equipment'])).toBeUndefined();
    expect(readCacheOwner()).toBe('u2');
    await vi.waitFor(() => expect(deleteMock).toHaveBeenCalledTimes(2));
    expect(deleteMock).toHaveBeenCalledWith('smi-api');
    expect(deleteMock).toHaveBeenCalledWith('smi-signed-files');
  });

  it('si la sesión terminó por 401 o vencimiento, la siguiente (aunque sea la misma persona) purga', () => {
    reconcileCacheOwner('u1');
    queryClient.setQueryData(['equipment'], [1]);
    markSessionEnded();

    expect(reconcileCacheOwner('u1')).toBe(true);

    expect(queryClient.getQueryData(['equipment'])).toBeUndefined();
    expect(readCacheOwner()).toBe('u1');
  });
});

describe('queryClient — un 401 de la API anota que la sesión terminó', () => {
  it('una query que falla con 401 deja la marca; otro error no', async () => {
    reconcileCacheOwner('u1');

    await queryClient
      .fetchQuery({ queryKey: ['x'], retry: false, queryFn: () => Promise.reject(new DomainError('boom', { status: 500 })) })
      .catch(() => undefined);
    expect(readCacheOwner()).toBe('u1');

    await queryClient
      .fetchQuery({ queryKey: ['y'], retry: false, queryFn: () => Promise.reject(new DomainError('no', { status: 401 })) })
      .catch(() => undefined);
    expect(readCacheOwner()).toBe('');
  });
});

describe('purgeSessionData', () => {
  it('sin Cache Storage solo vacía TanStack', async () => {
    queryClient.setQueryData(['equipment'], [1]);

    await purgeSessionData();

    expect(queryClient.getQueryData(['equipment'])).toBeUndefined();
  });
});
