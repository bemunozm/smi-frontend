import { vi } from 'vitest';

/**
 * Doble de `submitWrite` para los tests de oficina: se prueba lo que el hook
 * ENCOLA (endpoint, params, body, `expected`, archivos, dependencias) y cómo
 * reacciona a `sent` / `queued` / un error de negocio, sin ir a Dexie ni al
 * servidor. La cola real se prueba en `offline/*.test.ts`.
 *
 * Uso, en el test:
 * ```ts
 * vi.mock('../offline/submit-write', async (importOriginal) =>
 *   (await import('../test/office-write')).conSubmitWriteFalso(await importOriginal()));
 * ```
 */
export const submitWriteMock = vi.fn();

export function conSubmitWriteFalso<T extends object>(original: T): T & { submitWrite: typeof submitWriteMock } {
  return { ...original, submitWrite: submitWriteMock };
}

export const enviado = <T>(data: T | null = null, opId = 'op-1') => ({ status: 'sent' as const, data, opId });
export const encolado = (opId = 'op-1') => ({ status: 'queued' as const, opId });

/** Los argumentos de la última llamada a `submitWrite`: `[endpoint, input, options]`. */
export function ultimaEscritura(): { endpoint: string; input: Record<string, unknown>; options: { waitMs: number } } {
  const call = submitWriteMock.mock.calls.at(-1);
  if (!call) throw new Error('submitWrite no se llamó');
  return { endpoint: call[0], input: call[1], options: call[2] };
}
