import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * `public/push-sw.js` es un script CLÁSICO de service worker (lo carga
 * `importScripts` del SW generado por vite-plugin-pwa, ver `vite.config.ts`):
 * registra handlers sobre `self`. Acá se stubea `self` ANTES de importarlo y
 * se capturan los listeners para dispararlos a mano con eventos falsos.
 */

type Listener = (event: unknown) => void;

const listeners: Record<string, Listener> = {};
const showNotification = vi.fn<(titulo: string, options: unknown) => Promise<void>>();
const matchAll = vi.fn<() => Promise<unknown[]>>();
const openWindow = vi.fn<(url: string) => Promise<unknown>>();

vi.stubGlobal('self', {
  addEventListener: (type: string, listener: Listener) => {
    listeners[type] = listener;
  },
  registration: { showNotification },
  clients: { matchAll, openWindow },
});

interface FakePushEvent {
  data: { json: () => unknown } | null;
  waitUntil: ReturnType<typeof vi.fn>;
}

function pushEvent(data: FakePushEvent['data']): FakePushEvent {
  return { data, waitUntil: vi.fn() };
}

async function dispatchAndSettle(type: string, event: { waitUntil: ReturnType<typeof vi.fn> }): Promise<void> {
  listeners[type](event);
  // El handler delega el trabajo async a `waitUntil(promesa)`.
  const pending = event.waitUntil.mock.calls.map((call) => call[0] as Promise<unknown>);
  await Promise.all(pending);
}

const PAYLOAD = {
  notificationId: 'n1',
  tipo: 'hallazgo.created',
  titulo: 'Hallazgo de prioridad alta en EX-001',
  cuerpo: 'Fuga de aceite hidráulico',
  data: { equipoId: 'e1' },
};

beforeAll(async () => {
  // @ts-expect-error — script clásico de SW, sin tipos ni exports (ver cabecera).
  await import('../../public/push-sw.js');
});

beforeEach(() => {
  showNotification.mockReset();
  showNotification.mockResolvedValue(undefined);
  matchAll.mockReset();
  openWindow.mockReset();
  openWindow.mockResolvedValue(null);
});

describe('push-sw: handler push', () => {
  it('push con payload JSON muestra showNotification(titulo, { body, icon, badge, data })', async () => {
    const event = pushEvent({ json: () => PAYLOAD });

    await dispatchAndSettle('push', event);

    expect(showNotification).toHaveBeenCalledWith(PAYLOAD.titulo, {
      body: PAYLOAD.cuerpo,
      icon: '/pwa-192x192.png',
      badge: '/pwa-64x64.png',
      data: PAYLOAD,
    });
  });

  it('push sin data muestra una notificación genérica "SMI" en vez de lanzar', async () => {
    const event = pushEvent(null);

    await dispatchAndSettle('push', event);

    expect(showNotification).toHaveBeenCalledTimes(1);
    expect(showNotification.mock.calls[0][0]).toBe('SMI');
  });

  it('push con JSON inválido muestra la notificación genérica en vez de lanzar', async () => {
    const event = pushEvent({
      json: () => {
        throw new Error('payload corrupto');
      },
    });

    await dispatchAndSettle('push', event);

    expect(showNotification).toHaveBeenCalledTimes(1);
    expect(showNotification.mock.calls[0][0]).toBe('SMI');
  });
});

describe('push-sw: handler notificationclick', () => {
  function clickEvent() {
    return {
      notification: { close: vi.fn(), data: PAYLOAD },
      waitUntil: vi.fn(),
    };
  }

  it('cierra la notificación y enfoca la primera ventana abierta SIN navegarla', async () => {
    const focus = vi.fn().mockResolvedValue(undefined);
    const navigate = vi.fn();
    matchAll.mockResolvedValue([
      { focus, navigate },
      { focus: vi.fn(), navigate: vi.fn() },
    ]);
    const event = clickEvent();

    await dispatchAndSettle('notificationclick', event);

    expect(event.notification.close).toHaveBeenCalled();
    expect(matchAll).toHaveBeenCalledWith({
      type: 'window',
      includeUncontrolled: true,
    });
    expect(focus).toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();
    expect(openWindow).not.toHaveBeenCalled();
  });

  it('sin ventanas abiertas llama openWindow("/notificaciones")', async () => {
    matchAll.mockResolvedValue([]);
    const event = clickEvent();

    await dispatchAndSettle('notificationclick', event);

    expect(openWindow).toHaveBeenCalledWith('/notificaciones');
  });
});
