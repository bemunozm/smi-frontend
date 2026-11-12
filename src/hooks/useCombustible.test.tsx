import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

/**
 * `useCrearCargaCombustible` (alta online del panel admin): sube la foto solo
 * si hay y postea directo, sin outbox. La cola de Terreno
 * (`useCreateCombustible`) se prueba en `office-hooks.test.tsx`; acá se
 * reemplaza entera por un doble para no arrastrar el borde offline.
 */
const { uploadFileMock, createCombustibleMock, updateCombustibleMock, updateCardMock } = vi.hoisted(() => ({
  uploadFileMock: vi.fn(),
  createCombustibleMock: vi.fn(),
  updateCombustibleMock: vi.fn(),
  updateCardMock: vi.fn(),
}));

vi.mock('../api/UploadsAPI', () => ({ uploadFile: uploadFileMock }));
vi.mock('../api/CombustibleAPI', () => ({
  listCombustible: vi.fn(),
  createCombustible: createCombustibleMock,
  updateCombustible: updateCombustibleMock,
}));
vi.mock('../api/ShiftCardAPI', () => ({ ShiftCardAPI: { updateCard: updateCardMock } }));
vi.mock('./useQueuedMutation', () => ({ useQueuedCreate: vi.fn(() => ({ mutate: vi.fn() })) }));
vi.mock('@heroui/react', () => ({ toast: { success: vi.fn(), danger: vi.fn(), warning: vi.fn(), info: vi.fn() } }));

import { useCrearCargaCombustible, useEditarCargaCombustible } from './useCombustible';
import type { RegistroCombustible } from '../types/combustible';

const UUID = expect.stringMatching(/^[0-9a-f-]{36}$/);

function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={new QueryClient()}>{children}</QueryClientProvider>;
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const values = { equipoId: 'e1', litros: 35.5, tipo: 'PETROLEO' as const, fecha: '2026-11-06T10:00:00.000Z' };

describe('useCrearCargaCombustible — alta online del panel', () => {
  it('con foto: sube el archivo y postea con la fotoKey resultante', async () => {
    uploadFileMock.mockResolvedValue({ key: 'tmp/u1/foto.jpg', url: 'blob:x' });
    createCombustibleMock.mockResolvedValue({ id: 'c1' });
    const foto = new File(['x'], 'surtidor.jpg', { type: 'image/jpeg' });

    const { result } = renderHook(useCrearCargaCombustible, { wrapper });
    result.current.mutate({ values, foto });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(uploadFileMock).toHaveBeenCalledWith(foto);
    expect(createCombustibleMock).toHaveBeenCalledWith({ ...values, fotoKey: 'tmp/u1/foto.jpg', id: UUID });
  });

  it('sin foto: no sube nada y postea sin fotoKey', async () => {
    createCombustibleMock.mockResolvedValue({ id: 'c1' });

    const { result } = renderHook(useCrearCargaCombustible, { wrapper });
    result.current.mutate({ values, foto: null });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(uploadFileMock).not.toHaveBeenCalled();
    const [body] = createCombustibleMock.mock.calls[0] as [Record<string, unknown>];
    expect(body).toMatchObject({ ...values, id: UUID });
    expect(body).not.toHaveProperty('fotoKey');
  });
});

describe('useEditarCargaCombustible — corrección desde el panel', () => {
  const manual: RegistroCombustible = {
    id: 'c1',
    equipoId: 'e1',
    litros: 100000,
    tipo: 'PETROLEO',
    fotoUrl: null,
    fecha: '2026-11-10T10:00:00.000Z',
    registroHorometroId: null,
    origen: 'MANUAL',
    lectura: 1000,
  };

  it('una carga MANUAL parchea /combustible con los cambios', async () => {
    updateCombustibleMock.mockResolvedValue({ ...manual, litros: 100.4 });
    const { result } = renderHook(() => useEditarCargaCombustible(), { wrapper });

    result.current.mutate({ carga: manual, cambios: { litros: 100.4, lectura: 1200 } });

    await waitFor(() => expect(updateCombustibleMock).toHaveBeenCalledTimes(1));
    expect(updateCombustibleMock).toHaveBeenCalledWith('c1', { litros: 100.4, lectura: 1200 });
    expect(updateCardMock).not.toHaveBeenCalled();
  });

  it('una carga de TARJETA corrige la tarjeta vinculada, con los litros actuales como precondición', async () => {
    updateCardMock.mockResolvedValue({});
    const deTarjeta: RegistroCombustible = { ...manual, registroHorometroId: 'h1', origen: 'TARJETA' };
    const { result } = renderHook(() => useEditarCargaCombustible(), { wrapper });

    result.current.mutate({ carga: deTarjeta, cambios: { litros: 100.4 } });

    await waitFor(() => expect(updateCardMock).toHaveBeenCalledTimes(1));
    expect(updateCardMock).toHaveBeenCalledWith('h1', { fuelLiters: 100.4 }, { fuelLiters: 100000 });
    expect(updateCombustibleMock).not.toHaveBeenCalled();
  });
});
