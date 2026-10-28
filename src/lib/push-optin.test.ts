import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { clearPushOptIn, readPushOptIn, savePushOptIn } from './push-optin';

describe('push-optin', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('read devuelve false sin marca y true tras save; clear la borra', () => {
    expect(readPushOptIn('u1')).toBe(false);

    savePushOptIn('u1');
    expect(readPushOptIn('u1')).toBe(true);
    // La marca es POR usuario: la de u1 no habilita a u2 en el mismo equipo.
    expect(readPushOptIn('u2')).toBe(false);

    clearPushOptIn('u1');
    expect(readPushOptIn('u1')).toBe(false);
  });

  it('localStorage que lanza (modo privado): read devuelve false y save/clear no lanzan', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('bloqueado');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('bloqueado');
    });
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
      throw new Error('bloqueado');
    });

    expect(readPushOptIn('u1')).toBe(false);
    expect(() => savePushOptIn('u1')).not.toThrow();
    expect(() => clearPushOptIn('u1')).not.toThrow();
  });
});
