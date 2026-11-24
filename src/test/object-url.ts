import { vi } from 'vitest';

/**
 * jsdom no implementa `URL.createObjectURL`/`revokeObjectURL`: los reemplaza
 * por mocks (URLs únicas `blob:foto-N`) y devuelve cómo dejarlos como estaban.
 * Usar en `beforeEach` y llamar la restauración en `afterEach`.
 */
export function mockObjectUrls(): () => void {
  const create = Object.getOwnPropertyDescriptor(URL, 'createObjectURL');
  const revoke = Object.getOwnPropertyDescriptor(URL, 'revokeObjectURL');
  let n = 0;
  Object.defineProperty(URL, 'createObjectURL', {
    configurable: true,
    writable: true,
    value: vi.fn(() => `blob:foto-${++n}`),
  });
  Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, writable: true, value: vi.fn() });
  return () => {
    for (const [nombre, original] of [
      ['createObjectURL', create],
      ['revokeObjectURL', revoke],
    ] as const) {
      if (original) Object.defineProperty(URL, nombre, original);
      else delete (URL as unknown as Record<string, unknown>)[nombre];
    }
  };
}
