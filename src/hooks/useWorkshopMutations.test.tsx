import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

/**
 * Mutaciones orquestadas del taller (diseño Mantenedor Taller): lo que se
 * verifica es QUÉ encolan y EN QUÉ ORDEN — la intervención/creación primero,
 * el cambio de estado después — y cómo reaccionan a `sent`/`queued`/error.
 * El borde (`submitWrite`) se reemplaza por el doble oficial de oficina; la
 * cola real se prueba en `offline/*.test.ts`.
 */
const { avisarMock } = vi.hoisted(() => ({ avisarMock: vi.fn() }));

vi.mock('../offline/submit-write', async (importOriginal) =>
  (await import('../test/office-write')).conSubmitWriteFalso(await importOriginal()),
);
vi.mock('@heroui/react', () => ({
  toast: { success: vi.fn(), danger: vi.fn(), warning: vi.fn(), info: vi.fn() },
}));
vi.mock('../lib/outbox-feedback', () => ({ avisarGuardadoEnCola: avisarMock }));

import { toast } from '@heroui/react';
import { encolado, enviado, submitWriteMock } from '../test/office-write';
import type { OrdenTrabajo } from '../types/mantenimiento';
import { useFinishTask } from './useIntervenciones';
import { useLogOperation } from './useOrdenes';

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const UUID = /^[0-9a-f-]{36}$/;

const ORDEN: OrdenTrabajo = {
  id: 'ot-1',
  equipoId: 'CM-007',
  titulo: 'Cambio de aceite motor y filtro',
  estado: 'EN_PROCESO',
  prioridad: 'MEDIA',
  tipo: 'PREVENTIVA',
  origen: 'MANUAL',
  origenDetalle: null,
  asignadoA: null,
  tareas: [],
  createdAt: '2026-10-05T08:30:00.000Z',
  updatedAt: '2026-10-05T08:30:00.000Z',
};

const INTERVENCION_INPUT = {
  tipo: 'PREVENTIVA' as const,
  detalle: 'Drenaje de aceite y cambio de filtro.',
  horasHombre: 2,
  horometro: 1000,
  insumos: [{ insumoId: 'item-1', cantidad: 1 }],
};

function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={new QueryClient()}>{children}</QueryClientProvider>;
}

describe('useFinishTask', () => {
  it('encola la intervención de cierre y recién después el paso a COMPLETADA', async () => {
    submitWriteMock.mockResolvedValueOnce(enviado({ id: 'int-1' }));
    submitWriteMock.mockResolvedValueOnce(enviado({ ...ORDEN, estado: 'COMPLETADA' }));

    const { result } = renderHook(() => useFinishTask(), { wrapper });
    result.current.mutate({ orden: ORDEN, intervencion: INTERVENCION_INPUT });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const [first, second] = submitWriteMock.mock.calls;
    expect(first[0]).toBe('intervencion.create');
    expect(first[1]).toEqual({
      params: { ordenId: 'ot-1' },
      body: { ...INTERVENCION_INPUT, id: expect.stringMatching(UUID) },
    });
    expect(second[0]).toBe('orden.update');
    expect(second[1]).toEqual({ params: { id: 'ot-1' }, body: { estado: 'COMPLETADA' } });
    expect(toast.success).toHaveBeenCalledWith('Operación finalizada', {
      description: ORDEN.titulo,
    });
  });

  it('si la intervención falla, NO toca el estado de la orden', async () => {
    submitWriteMock.mockRejectedValueOnce(new Error('falló'));

    const { result } = renderHook(() => useFinishTask(), { wrapper });
    result.current.mutate({ orden: ORDEN, intervencion: INTERVENCION_INPUT });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(submitWriteMock).toHaveBeenCalledTimes(1);
    expect(toast.danger).toHaveBeenCalled();
  });

  it('si queda esperando señal, avisa "guardado en el equipo" en vez de éxito', async () => {
    submitWriteMock.mockResolvedValueOnce(encolado('op-1'));
    submitWriteMock.mockResolvedValueOnce(encolado('op-2'));

    const { result } = renderHook(() => useFinishTask(), { wrapper });
    result.current.mutate({ orden: ORDEN, intervencion: INTERVENCION_INPUT });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(submitWriteMock).toHaveBeenCalledTimes(2);
    expect(avisarMock).toHaveBeenCalled();
    expect(toast.success).not.toHaveBeenCalled();
  });
});

describe('useLogOperation', () => {
  it('encola la creación con id de cliente y detrás el paso a EN_PROCESO con ese mismo id', async () => {
    submitWriteMock.mockResolvedValueOnce(enviado({ ...ORDEN, id: 'ot-9', estado: 'PENDIENTE' }));
    submitWriteMock.mockResolvedValueOnce(enviado({ ...ORDEN, id: 'ot-9', estado: 'EN_PROCESO' }));

    const { result } = renderHook(() => useLogOperation(), { wrapper });
    const input = {
      equipoId: 'CM-007',
      titulo: 'Cambio de aceite motor y filtro',
      prioridad: 'MEDIA' as const,
      tipo: 'PREVENTIVA' as const,
      origen: 'PREVENTIVO' as const,
    };
    result.current.mutate(input);

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const [first, second] = submitWriteMock.mock.calls;
    expect(first[0]).toBe('orden.create');
    const createdId = (first[1] as { body: { id: string } }).body.id;
    expect(createdId).toMatch(UUID);
    expect(first[1]).toEqual({ params: {}, body: { ...input, id: createdId } });
    expect(second[0]).toBe('orden.update');
    expect(second[1]).toEqual({ params: { id: createdId }, body: { estado: 'EN_PROCESO' } });
    expect(toast.success).toHaveBeenCalledWith('Operación iniciada', {
      description: ORDEN.titulo,
    });
  });
});
