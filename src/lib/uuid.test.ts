import { afterEach, describe, expect, it, vi } from 'vitest';

import { generateUuid } from './uuid';

const UUID_V4_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const originalCrypto = globalThis.crypto;

afterEach(() => {
  Object.defineProperty(globalThis, 'crypto', { value: originalCrypto, configurable: true });
});

describe('generateUuid', () => {
  it('usa crypto.randomUUID() cuando está disponible (contexto seguro)', () => {
    const randomUUID = vi.fn(() => '11111111-1111-4111-8111-111111111111');
    Object.defineProperty(globalThis, 'crypto', {
      value: { randomUUID, getRandomValues: vi.fn() },
      configurable: true,
    });

    expect(generateUuid()).toBe('11111111-1111-4111-8111-111111111111');
    expect(randomUUID).toHaveBeenCalledTimes(1);
  });

  /**
   * El túnel HTTP temporal a la tablet (ver el plan "Supervisión en
   * Terreno": "No hay VPS ni dominio") no es un contexto seguro —
   * `crypto.randomUUID` falta, pero `crypto.getRandomValues` sí está.
   */
  it('cae a crypto.getRandomValues cuando randomUUID no existe (contexto no seguro)', () => {
    const getRandomValues = vi.fn((bytes: Uint8Array) => {
      bytes.fill(0xab);
      return bytes;
    });
    Object.defineProperty(globalThis, 'crypto', {
      value: { getRandomValues },
      configurable: true,
    });

    const id = generateUuid();

    expect(getRandomValues).toHaveBeenCalledTimes(1);
    expect(id).toMatch(UUID_V4_REGEX);
  });

  it('el fallback arma un UUID v4 válido en cada llamada (bits de versión/variante correctos)', () => {
    Object.defineProperty(globalThis, 'crypto', {
      value: {
        getRandomValues: (bytes: Uint8Array) => {
          for (let i = 0; i < bytes.length; i += 1) bytes[i] = i * 17;
          return bytes;
        },
      },
      configurable: true,
    });

    expect(generateUuid()).toMatch(UUID_V4_REGEX);
  });

  it('lanza un error legible si no hay ninguna fuente de aleatoriedad disponible', () => {
    Object.defineProperty(globalThis, 'crypto', { value: undefined, configurable: true });

    expect(() => generateUuid()).toThrow(/aleatoriedad criptográfica/);
  });
});
