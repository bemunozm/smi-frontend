import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Las escrituras van por la cola: se prueba lo que se encola (ver `test/office-write.ts`).
vi.mock('../offline/submit-write', async (importOriginal) =>
  (await import('../test/office-write')).conSubmitWriteFalso(await importOriginal()),
);
vi.mock('@heroui/react', () => ({ toast: { success: vi.fn(), danger: vi.fn() } }));

import { toast } from '@heroui/react';
import { DomainError } from '../lib/api-error';
import { ENDPOINTS } from '../offline/endpoints';
import { enviado, submitWriteMock, ultimaEscritura } from '../test/office-write';
import { useCorregirUltimoCambio } from './useMaintenancePlans';

afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});

function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={new QueryClient()}>{children}</QueryClientProvider>;
}

const VARS = { equipmentId: 'eq_1', internalCode: 'SEM 02', doneAt: '2026-10-02', counterAt: 2260.5 };

describe('useCorregirUltimoCambio', () => {
  it('encola el PATCH del último cambio con fecha y lectura, y avisa al confirmarse', async () => {
    submitWriteMock.mockResolvedValueOnce(enviado(null));
    const { result } = renderHook(() => useCorregirUltimoCambio(), { wrapper });

    result.current.mutate(VARS);

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const { endpoint, input } = ultimaEscritura();
    expect(endpoint).toBe('maintenancePlan.lastChange');
    expect(input).toEqual({ params: { equipmentId: 'eq_1' }, body: { doneAt: '2026-10-02', counterAt: 2260.5 } });
    expect(toast.success).toHaveBeenCalledWith('Último cambio corregido', { description: 'SEM 02' });
  });

  it('el 400 del backend llega tal cual en el toast de error', async () => {
    submitWriteMock.mockRejectedValueOnce(
      new DomainError('La lectura no puede ser mayor que el horómetro actual del equipo.', { status: 400 }),
    );
    const { result } = renderHook(() => useCorregirUltimoCambio(), { wrapper });

    result.current.mutate(VARS);

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(toast.danger).toHaveBeenCalledWith('La lectura no puede ser mayor que el horómetro actual del equipo.');
  });

  it('el endpoint es un PATCH a /last-change que refresca la raíz de las pautas', () => {
    const def = ENDPOINTS['maintenancePlan.lastChange'];
    expect(def.method).toBe('PATCH');
    expect(def.path({ equipmentId: 'eq_1' })).toBe('/api/maintenance-plans/eq_1/last-change');
    expect(def.invalidate).toEqual(['maintenancePlans']);
  });
});
