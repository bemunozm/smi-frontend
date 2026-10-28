import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { PushAPI } from '../api/PushAPI';
import {
  disablePush,
  enablePush,
  getPushDeviceStatus,
  isPushSupported,
  resubscribeIfOptedIn,
  unsubscribePushOnLogout,
} from './push-device';
import { readPushOptIn, savePushOptIn } from './push-optin';

vi.mock('../api/PushAPI', () => ({
  PushAPI: {
    vapidPublicKey: vi.fn(),
    subscribe: vi.fn(),
    unsubscribe: vi.fn(),
  },
}));

const vapidPublicKey = vi.mocked(PushAPI.vapidPublicKey);
const apiSubscribe = vi.mocked(PushAPI.subscribe);
const apiUnsubscribe = vi.mocked(PushAPI.unsubscribe);

const SUBSCRIPTION_JSON = {
  endpoint: 'https://push.example/sub-1',
  keys: { p256dh: 'p256dh-key', auth: 'auth-key' },
};

function fakeSubscription() {
  return {
    endpoint: SUBSCRIPTION_JSON.endpoint,
    toJSON: () => SUBSCRIPTION_JSON,
    unsubscribe: vi.fn().mockResolvedValue(true),
  };
}

const getSubscription = vi.fn();
const pmSubscribe = vi.fn();
const requestPermission = vi.fn();

/** Instala el entorno COMPLETO de un navegador con push soportado. Los tests
 * de "no soportado" pisan estos stubs con variantes incompletas. */
function stubSupportedBrowser(permission: NotificationPermission = 'granted'): void {
  vi.stubGlobal('navigator', {
    serviceWorker: {
      ready: Promise.resolve({ pushManager: { getSubscription, subscribe: pmSubscribe } }),
    },
    userAgent: 'test-agent',
  });
  vi.stubGlobal('PushManager', function PushManager() {});
  vi.stubGlobal('Notification', { permission, requestPermission });
}

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  getSubscription.mockResolvedValue(null);
  pmSubscribe.mockResolvedValue(fakeSubscription());
  vapidPublicKey.mockResolvedValue('QUJDREVGRw');
  apiSubscribe.mockResolvedValue(undefined);
  apiUnsubscribe.mockResolvedValue(undefined);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('isPushSupported', () => {
  it('false sin serviceWorker o sin PushManager o sin Notification', () => {
    vi.stubGlobal('navigator', { userAgent: 'test-agent' });
    vi.stubGlobal('PushManager', function PushManager() {});
    vi.stubGlobal('Notification', { permission: 'default', requestPermission });
    expect(isPushSupported()).toBe(false);

    stubSupportedBrowser();
    expect(isPushSupported()).toBe(true);
  });
});

describe('getPushDeviceStatus', () => {
  it('denied cuando el permiso está bloqueado; subscribed/unsubscribed según el pushManager', async () => {
    stubSupportedBrowser('denied');
    expect(await getPushDeviceStatus()).toBe('denied');

    stubSupportedBrowser('granted');
    getSubscription.mockResolvedValue(fakeSubscription());
    expect(await getPushDeviceStatus()).toBe('subscribed');

    getSubscription.mockResolvedValue(null);
    expect(await getPushDeviceStatus()).toBe('unsubscribed');
  });
});

describe('enablePush', () => {
  it('permission granted → subscribe({ userVisibleOnly, applicationServerKey }) → POST → guarda opt-in → "subscribed"', async () => {
    stubSupportedBrowser('default');
    requestPermission.mockResolvedValue('granted');

    const status = await enablePush('u1');

    expect(status).toBe('subscribed');
    expect(pmSubscribe).toHaveBeenCalledWith({
      userVisibleOnly: true,
      applicationServerKey: expect.any(Uint8Array),
    });
    expect(apiSubscribe).toHaveBeenCalledWith({
      ...SUBSCRIPTION_JSON,
      userAgent: 'test-agent',
    });
    expect(readPushOptIn('u1')).toBe(true);
  });

  it('permission denied → "denied", sin subscribe ni POST ni marca', async () => {
    stubSupportedBrowser('default');
    requestPermission.mockResolvedValue('denied');

    const status = await enablePush('u1');

    expect(status).toBe('denied');
    expect(pmSubscribe).not.toHaveBeenCalled();
    expect(apiSubscribe).not.toHaveBeenCalled();
    expect(readPushOptIn('u1')).toBe(false);
  });
});

describe('disablePush', () => {
  it('unsubscribe local + PushAPI.unsubscribe(endpoint) + borra la marca', async () => {
    stubSupportedBrowser();
    const subscription = fakeSubscription();
    getSubscription.mockResolvedValue(subscription);
    savePushOptIn('u1');

    await disablePush('u1');

    expect(subscription.unsubscribe).toHaveBeenCalled();
    expect(apiUnsubscribe).toHaveBeenCalledWith(SUBSCRIPTION_JSON.endpoint);
    expect(readPushOptIn('u1')).toBe(false);
  });

  it('un DELETE que falla (sin red) NO deshace el apagado: la marca se borra igual y no lanza', async () => {
    stubSupportedBrowser();
    const subscription = fakeSubscription();
    getSubscription.mockResolvedValue(subscription);
    savePushOptIn('u1');
    apiUnsubscribe.mockRejectedValue(new Error('sin red'));

    await expect(disablePush('u1')).resolves.toBeUndefined();

    // La marca registra la INTENCIÓN del usuario: sin esto, el próximo login
    // resuscribiría en silencio un push que la persona apagó a propósito.
    expect(readPushOptIn('u1')).toBe(false);
    expect(subscription.unsubscribe).toHaveBeenCalled();
  });
});

describe('resubscribeIfOptedIn', () => {
  it('con marca + permiso granted → (re)suscribe y hace POST', async () => {
    stubSupportedBrowser('granted');
    savePushOptIn('u1');

    await resubscribeIfOptedIn('u1');

    expect(apiSubscribe).toHaveBeenCalledWith({
      ...SUBSCRIPTION_JSON,
      userAgent: 'test-agent',
    });
  });

  it('sin marca, o permiso ≠ granted, o no soportado → no hace nada', async () => {
    stubSupportedBrowser('granted');
    await resubscribeIfOptedIn('u1'); // sin marca

    stubSupportedBrowser('default');
    savePushOptIn('u1');
    await resubscribeIfOptedIn('u1'); // permiso sin conceder

    vi.stubGlobal('navigator', { userAgent: 'test-agent' }); // sin serviceWorker
    await resubscribeIfOptedIn('u1');

    expect(apiSubscribe).not.toHaveBeenCalled();
  });

  it('si PushAPI falla, no lanza', async () => {
    stubSupportedBrowser('granted');
    savePushOptIn('u1');
    apiSubscribe.mockRejectedValue(new Error('sin red'));

    await expect(resubscribeIfOptedIn('u1')).resolves.toBeUndefined();
  });
});

describe('unsubscribePushOnLogout', () => {
  it('desuscribe local + DELETE, y CONSERVA la marca opt-in (el re-login resuscribe solo)', async () => {
    stubSupportedBrowser();
    const subscription = fakeSubscription();
    getSubscription.mockResolvedValue(subscription);
    savePushOptIn('u1');

    await unsubscribePushOnLogout();

    expect(apiUnsubscribe).toHaveBeenCalledWith(SUBSCRIPTION_JSON.endpoint);
    expect(subscription.unsubscribe).toHaveBeenCalled();
    expect(readPushOptIn('u1')).toBe(true);
  });

  it('un DELETE que falla (sin red) igual desuscribe LOCALMENTE: el endpoint muere y el 404/410 limpia la fila', async () => {
    stubSupportedBrowser();
    const subscription = fakeSubscription();
    getSubscription.mockResolvedValue(subscription);
    apiUnsubscribe.mockRejectedValue(new Error('sin red'));

    await expect(unsubscribePushOnLogout()).resolves.toBeUndefined();

    // Esto es lo que impide que una tablet compartida siga recibiendo avisos
    // del usuario que se fue: el unsubscribe local funciona SIN señal.
    expect(subscription.unsubscribe).toHaveBeenCalled();
  });

  it('sin suscripción no llama al API', async () => {
    stubSupportedBrowser();
    getSubscription.mockResolvedValue(null);

    await unsubscribePushOnLogout();

    expect(apiUnsubscribe).not.toHaveBeenCalled();
  });
});
