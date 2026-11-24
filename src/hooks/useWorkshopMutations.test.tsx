import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

/**
 * Mutaciones orquestadas del taller (diseño Mantenedor Taller): lo que se
 * verifica es QUÉ encolan y EN QUÉ ORDEN — la creación primero, el cambio de
 * estado después; el cierre, en una sola escritura — y cómo reaccionan a
 * `sent`/`queued`/error.
 * El borde (`submitWrite`) se reemplaza por el doble oficial de oficina; la
 * cola real se prueba en `offline/*.test.ts`.
 */
const { avisarMock } = vi.hoisted(() => ({ avisarMock: vi.fn() }));

vi.mock('../offline/submit-write', async (importOriginal) =>
  (await import('../test/office-write')).conSubmitWriteFalso(await importOriginal()),
);
vi.mock('@heroui/react', () => ({ toast: { success: vi.fn(), danger: vi.fn(), warning: vi.fn(), info: vi.fn() } }));
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
  hallazgoId: null,
  pautaMilestone: null,
  pautaCycle: null,
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
  const RESULTADO = { orden: { ...ORDEN, estado: 'COMPLETADA' }, intervencion: { id: 'int-1' } };

  it('cierra la orden en UNA sola escritura atómica (orden.finalizar), con id de cliente para la intervención', async () => {
    submitWriteMock.mockResolvedValueOnce(enviado(RESULTADO, 'op-finalizar'));

    const { result } = renderHook(() => useFinishTask(), { wrapper });
    result.current.mutate({ orden: ORDEN, intervencion: INTERVENCION_INPUT });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    // Una sola escritura: o queda la intervención + stock + COMPLETADA, o nada
    // (antes eran dos y un rechazo del PATCH dejaba el cierre a medias).
    expect(submitWriteMock).toHaveBeenCalledTimes(1);
    const [endpoint, input] = submitWriteMock.mock.calls[0];
    expect(endpoint).toBe('orden.finalizar');
    expect(input).toEqual({ params: { id: 'ot-1' }, body: { ...INTERVENCION_INPUT, id: expect.stringMatching(UUID) } });
    expect(toast.success).toHaveBeenCalledWith('Operación finalizada', { description: ORDEN.titulo });
  });

  it('el estado del equipo y la lectura de la mantención viajan en el mismo body', async () => {
    submitWriteMock.mockResolvedValueOnce(enviado(RESULTADO));

    const { result } = renderHook(() => useFinishTask(), { wrapper });
    result.current.mutate({
      orden: ORDEN,
      intervencion: INTERVENCION_INPUT,
      equipmentStatus: 'OUT_OF_SERVICE',
      lecturaMantencion: 264582,
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(submitWriteMock.mock.calls[0][1]).toEqual({
      params: { id: 'ot-1' },
      body: {
        ...INTERVENCION_INPUT,
        id: expect.stringMatching(UUID),
        equipmentStatus: 'OUT_OF_SERVICE',
        lecturaMantencion: 264582,
      },
    });
  });

  it('la foto del cierre viaja como archivo del write (el replay inyecta fotoKey)', async () => {
    submitWriteMock.mockResolvedValueOnce(enviado(RESULTADO));
    const foto = new File(['x'], 'cierre.jpg', { type: 'image/jpeg' });

    const { result } = renderHook(() => useFinishTask(), { wrapper });
    result.current.mutate({ orden: ORDEN, intervencion: INTERVENCION_INPUT, foto });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect((submitWriteMock.mock.calls[0][1] as { files?: unknown }).files).toEqual([{ field: 'fotoKey', file: foto }]);
  });

  it('sin foto, el write no lleva archivos', async () => {
    submitWriteMock.mockResolvedValueOnce(enviado(RESULTADO));

    const { result } = renderHook(() => useFinishTask(), { wrapper });
    result.current.mutate({ orden: ORDEN, intervencion: INTERVENCION_INPUT, foto: null });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect((submitWriteMock.mock.calls[0][1] as { files?: unknown }).files).toBeUndefined();
  });

  it('si el servidor la rechaza, avisa el error y no intenta nada más', async () => {
    submitWriteMock.mockRejectedValueOnce(new Error('falló'));

    const { result } = renderHook(() => useFinishTask(), { wrapper });
    result.current.mutate({ orden: ORDEN, intervencion: INTERVENCION_INPUT });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(submitWriteMock).toHaveBeenCalledTimes(1);
    expect(toast.danger).toHaveBeenCalled();
  });

  it('si queda esperando señal, avisa "guardado en el equipo" en vez de éxito', async () => {
    submitWriteMock.mockResolvedValueOnce(encolado('op-1'));

    const { result } = renderHook(() => useFinishTask(), { wrapper });
    result.current.mutate({ orden: ORDEN, intervencion: INTERVENCION_INPUT });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(submitWriteMock).toHaveBeenCalledTimes(1);
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
    expect(toast.success).toHaveBeenCalledWith('Operación iniciada', { description: ORDEN.titulo });
  });
});
