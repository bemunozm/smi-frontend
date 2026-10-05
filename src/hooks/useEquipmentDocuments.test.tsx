import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const { listMock } = vi.hoisted(() => ({ listMock: vi.fn() }));

vi.mock('../api/EquipmentDocumentAPI', () => ({ EquipmentDocumentAPI: { list: listMock } }));

// Las escrituras van por la cola: se prueba lo que se encola (ver `test/office-write.ts`).
vi.mock('../offline/submit-write', async (importOriginal) =>
  (await import('../test/office-write')).conSubmitWriteFalso(await importOriginal()),
);

// El hook llama a `toast.success`/`toast.danger` — no importa la UI real de
// HeroUI acá, solo que la función exista y no reviente el test.
vi.mock('@heroui/react', () => ({
  toast: { success: vi.fn(), danger: vi.fn() },
}));

import { toast } from '@heroui/react';
import { encolado, enviado, submitWriteMock, ultimaEscritura } from '../test/office-write';
import type { EquipmentDocument } from '../types/equipment-document';
import {
  useCreateEquipmentDocument,
  useDeleteEquipmentDocument,
  useEquipmentDocuments,
  useUpdateEquipmentDocument,
} from './useEquipmentDocuments';

afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});

const DOCUMENTO = {
  id: 'doc_1',
  equipmentId: 'eq_1',
  type: 'TECHNICAL_INSPECTION',
  title: 'Revisión anual',
  expiryDate: '2026-12-01T00:00:00.000Z',
  fileUrl: '/uploads/rt.pdf',
  fileName: 'rt.pdf',
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

const DOC = DOCUMENTO as unknown as EquipmentDocument;

function wrapperNuevo() {
  return withQueryClient(new QueryClient());
}

describe('useCreateEquipmentDocument', () => {
  it('encola equipmentDocument.create con el id del cliente y el archivo como adjunto', async () => {
    submitWriteMock.mockResolvedValueOnce(enviado(DOC));
    const archivo = new File(['x'], 'poliza.pdf', { type: 'application/pdf' });
    const { result } = renderHook(() => useCreateEquipmentDocument('eq_1'), { wrapper: wrapperNuevo() });

    result.current.mutate({ input: { type: 'INSURANCE', fileName: 'poliza.pdf' }, file: archivo });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const { endpoint, input } = ultimaEscritura();
    expect(endpoint).toBe('equipmentDocument.create');
    expect(input).toMatchObject({
      params: { equipmentId: 'eq_1' },
      body: { type: 'INSURANCE', fileName: 'poliza.pdf', id: expect.stringMatching(/^[0-9a-f-]{36}$/) },
      files: [{ field: 'fileKey', file: archivo }],
    });
    expect(toast.success).toHaveBeenCalledWith('Documento creado');
  });

  it('sin archivo no manda files; en cola avisa que quedó guardado en el equipo', async () => {
    submitWriteMock.mockResolvedValueOnce(encolado());
    const { result } = renderHook(() => useCreateEquipmentDocument('eq_1'), { wrapper: wrapperNuevo() });

    result.current.mutate({ input: { type: 'OTHER' } });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(ultimaEscritura().input.files).toBeUndefined();
    expect(toast.success).toHaveBeenCalledWith(expect.stringContaining('Guardado'));
  });
});

describe('useUpdateEquipmentDocument', () => {
  const input = { type: 'TECHNICAL_INSPECTION' as const, title: 'Revisión 2027', expiryDate: '2026-12-01', notes: null };

  it('manda solo lo tocado, con la base como precondición (la fecha como YYYY-MM-DD)', async () => {
    submitWriteMock.mockResolvedValueOnce(enviado(DOC));
    const { result } = renderHook(() => useUpdateEquipmentDocument(), { wrapper: wrapperNuevo() });

    result.current.mutate({ documento: DOC, input });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const { endpoint, input: encolado_ } = ultimaEscritura();
    expect(endpoint).toBe('equipmentDocument.update');
    expect(encolado_).toMatchObject({
      params: { id: 'doc_1' },
      body: { title: 'Revisión 2027' },
      expected: { title: 'Revisión anual' },
    });
    expect(encolado_.files).toBeUndefined();
    expect(toast.success).toHaveBeenCalledWith('Documento actualizado');
  });

  it('un archivo nuevo viaja como adjunto con su nombre; quitarlo manda fileKey y fileName en null', async () => {
    submitWriteMock.mockResolvedValue(enviado(DOC));
    const { result } = renderHook(() => useUpdateEquipmentDocument(), { wrapper: wrapperNuevo() });
    const archivo = new File(['x'], 'nuevo.pdf', { type: 'application/pdf' });

    result.current.mutate({ documento: DOC, input: { ...input, title: 'Revisión anual' }, file: archivo });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(ultimaEscritura().input).toMatchObject({
      body: { fileName: 'nuevo.pdf' },
      expected: { fileName: 'rt.pdf' },
      files: [{ field: 'fileKey', file: archivo }],
    });
    // La key del archivo no es parte de la precondición.
    expect(ultimaEscritura().input.expected).not.toHaveProperty('fileKey');

    result.current.mutate({ documento: DOC, input: { ...input, title: 'Revisión anual' }, file: null });
    await waitFor(() => expect(submitWriteMock).toHaveBeenCalledTimes(2));
    expect(ultimaEscritura().input).toMatchObject({ body: { fileKey: null, fileName: null } });
  });

  it('sin cambios no encola nada', async () => {
    const { result } = renderHook(() => useUpdateEquipmentDocument(), { wrapper: wrapperNuevo() });

    result.current.mutate({ documento: DOC, input: { ...input, title: 'Revisión anual' } });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(submitWriteMock).not.toHaveBeenCalled();
  });
});

describe('useDeleteEquipmentDocument', () => {
  it('encola equipmentDocument.delete con el id', async () => {
    submitWriteMock.mockResolvedValueOnce(enviado(true));
    const { result } = renderHook(() => useDeleteEquipmentDocument(), { wrapper: wrapperNuevo() });

    result.current.mutate('doc_1');

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(ultimaEscritura()).toMatchObject({
      endpoint: 'equipmentDocument.delete',
      input: { params: { id: 'doc_1' } },
    });
    expect(toast.success).toHaveBeenCalledWith('Documento eliminado');
  });
});
