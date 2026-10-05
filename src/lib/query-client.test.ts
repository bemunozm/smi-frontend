import { afterEach, describe, expect, it } from 'vitest';
import { onlineManager } from '@tanstack/react-query';

import { queryClient } from './query-client';

afterEach(() => {
  onlineManager.setOnline(true);
});

describe('queryClient — modo de red', () => {
  it('las queries siguen offlineFirst (el Service Worker las resuelve sin señal)', () => {
    expect(queryClient.getDefaultOptions().queries?.networkMode).toBe('offlineFirst');
  });

  it('las mutaciones son `always`: sin señal fallan rápido en vez de pausarse en silencio', () => {
    expect(queryClient.getDefaultOptions().mutations?.networkMode).toBe('always');
  });

  it('una mutación con la red caída se EJECUTA y rechaza (con `online` quedaría pausada para siempre)', async () => {
    onlineManager.setOnline(false);
    const mutation = queryClient.getMutationCache().build(queryClient, {
      mutationFn: () => Promise.reject(new Error('Sin señal')),
    });

    await expect(mutation.execute(undefined)).rejects.toThrow('Sin señal');
    expect(mutation.state.status).toBe('error');
  }, 2000);
});
