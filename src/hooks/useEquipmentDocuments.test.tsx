import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const { listMock, createMock, updateMock, removeMock } = vi.hoisted(() => ({
  listMock: vi.fn(),
  createMock: vi.fn(),
  updateMock: vi.fn(),
  removeMock: vi.fn(),
}));

vi.mock('../api/EquipmentDocumentAPI', () => ({
  EquipmentDocumentAPI: {
    list: listMock,
    create: createMock,
    update: updateMock,
    remove: removeMock,
  },
}));

// El hook llama a `toast.success`/`toast.danger` — no importa la UI real de
// HeroUI acá, solo que la función exista y no reviente el test.
vi.mock('@heroui/react', () => ({
  toast: { success: vi.fn(), danger: vi.fn() },
}));

import {
  useCreateEquipmentDocument,
  useDeleteEquipmentDocument,
  useEquipmentDocuments,
  useUpdateEquipmentDocument,
} from './useEquipmentDocuments';

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const DOCUMENTO = {
  id: 'doc_1',
  equipmentId: 'eq_1',
  type: 'TECHNICAL_INSPECTION',
  title: 'Revisión anual',
  expiryDate: '2026-12-01T00:00:00.000Z',
  fileUrl: '/uploads/rt.pdf',
  notes: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  status: 'VIGENTE',
  daysToExpiry: 71,
};

function withQueryClient(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

describe('useEquipmentDocuments', () => {
  it('no dispara la query cuando el equipmentId viene vacío', () => {
    const queryClient = new QueryClient();

    const { result } = renderHook(() => useEquipmentDocuments(''), { wrapper: withQueryClient(queryClient) });

    expect(result.current.fetchStatus).toBe('idle');
    expect(listMock).not.toHaveBeenCalled();
  });

  it('pide los documentos de ESE equipo y los cachea bajo ["equipment-documents", equipmentId]', async () => {
    listMock.mockResolvedValueOnce([DOCUMENTO]);
    const queryClient = new QueryClient();

    const { result } = renderHook(() => useEquipmentDocuments('eq_1'), { wrapper: withQueryClient(queryClient) });

    await waitFor(() => expect(result.current.data).toEqual([DOCUMENTO]));
    expect(listMock).toHaveBeenCalledWith('eq_1');
    expect(queryClient.getQueryData(['equipment-documents', 'eq_1'])).toEqual([DOCUMENTO]);
  });
});

describe('useCreateEquipmentDocument', () => {
  it('crea el documento e invalida la lista de ESTE equipo Y el árbol ["equipment"]', async () => {
    createMock.mockResolvedValueOnce(DOCUMENTO);
    const queryClient = new QueryClient();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(() => useCreateEquipmentDocument('eq_1'), {
      wrapper: withQueryClient(queryClient),
    });

    result.current.mutate({ type: 'TECHNICAL_INSPECTION' });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(createMock).toHaveBeenCalledWith('eq_1', { type: 'TECHNICAL_INSPECTION' });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['equipment-documents', 'eq_1'] });
    // El badge `documentsAlert` del listado/ficha se deriva de los
    // documentos — sin esta invalidación quedaría desactualizado.
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['equipment'] });
  });
});

describe('useUpdateEquipmentDocument', () => {
  it('llama a EquipmentDocumentAPI.update con el id y el body, e invalida ambos árboles', async () => {
    updateMock.mockResolvedValueOnce({ ...DOCUMENTO, title: 'Revisión anual (renovada)' });
    const queryClient = new QueryClient();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(() => useUpdateEquipmentDocument('eq_1'), {
      wrapper: withQueryClient(queryClient),
    });

    result.current.mutate({ id: 'doc_1', input: { title: 'Revisión anual (renovada)' } });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(updateMock).toHaveBeenCalledWith('doc_1', { title: 'Revisión anual (renovada)' });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['equipment-documents', 'eq_1'] });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['equipment'] });
  });
});

describe('useDeleteEquipmentDocument', () => {
  it('elimina el documento e invalida ambos árboles', async () => {
    removeMock.mockResolvedValueOnce(undefined);
    const queryClient = new QueryClient();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(() => useDeleteEquipmentDocument('eq_1'), {
      wrapper: withQueryClient(queryClient),
    });

    result.current.mutate('doc_1');

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(removeMock).toHaveBeenCalledWith('doc_1');
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['equipment-documents', 'eq_1'] });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['equipment'] });
  });
});
