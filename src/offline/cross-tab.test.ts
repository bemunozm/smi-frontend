import { afterEach, describe, expect, it, vi } from 'vitest';
import { waitFor } from '@testing-library/react';

import { closeCrossTab, listenCrossTab, publishOutcome, requestRemoteSync } from './cross-tab';

afterEach(() => {
  closeCrossTab();
  vi.unstubAllGlobals();
});

describe('cross-tab', () => {
  it('entrega a quien escucha lo que publica otra pestaña, y no lo que publica uno mismo', async () => {
    const onOutcome = vi.fn();
    const onSyncRequested = vi.fn();
    listenCrossTab({ onOutcome, onSyncRequested });
    const otra = new BroadcastChannel('smi-outbox');

    otra.postMessage({ type: 'outcome', opId: 'op-1', outcome: { kind: 'sent', data: { ok: true } } });
    otra.postMessage({ type: 'sync-requested' });

    await waitFor(() => expect(onOutcome).toHaveBeenCalledWith('op-1', { kind: 'sent', data: { ok: true } }));
    await waitFor(() => expect(onSyncRequested).toHaveBeenCalledTimes(1));

    publishOutcome('propia', { kind: 'sent', data: null });
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(onOutcome).toHaveBeenCalledTimes(1);
    otra.close();
  });

  it('ignora mensajes que no son de este protocolo', async () => {
    const onOutcome = vi.fn();
    listenCrossTab({ onOutcome, onSyncRequested: vi.fn() });
    const otra = new BroadcastChannel('smi-outbox');

    otra.postMessage('hola');
    otra.postMessage({ type: 'otra-cosa' });
    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(onOutcome).not.toHaveBeenCalled();
    otra.close();
  });

  it('publica y pide sincronizar a las otras pestañas', async () => {
    listenCrossTab({ onOutcome: vi.fn(), onSyncRequested: vi.fn() });
    const otra = new BroadcastChannel('smi-outbox');
    const recibidos: unknown[] = [];
    otra.onmessage = (evento: MessageEvent<unknown>) => recibidos.push(evento.data);

    publishOutcome('op-1', { kind: 'business', message: 'x', code: 'C', status: 409 });
    requestRemoteSync();

    await waitFor(() => expect(recibidos).toHaveLength(2));
    expect(recibidos).toContainEqual({
      type: 'outcome',
      opId: 'op-1',
      outcome: { kind: 'business', message: 'x', code: 'C', status: 409 },
    });
    expect(recibidos).toContainEqual({ type: 'sync-requested' });
    otra.close();
  });

  it('sin BroadcastChannel (navegador viejo) no hace nada y no lanza', () => {
    vi.stubGlobal('BroadcastChannel', undefined);

    expect(() => {
      listenCrossTab({ onOutcome: vi.fn(), onSyncRequested: vi.fn() });
      publishOutcome('op-1', { kind: 'sent', data: null });
      requestRemoteSync();
    }).not.toThrow();
  });
});
