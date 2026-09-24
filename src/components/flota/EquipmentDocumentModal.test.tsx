import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { env } from '../../config/env';
import { EquipmentDocumentModal } from './EquipmentDocumentModal';
import type { EquipmentDocument } from '../../types/equipment-document';

/**
 * Tests focalizados de `EquipmentDocumentModal` — mismo criterio de refetch
 * que `EquipoEditDelete.test.tsx` (Fix 1, review QA del RFC R2-storage) más
 * el link "Ver archivo actual" al endpoint 302 (QA menor, mismo review).
 *
 * Se mockean los hooks de datos (no la capa de API), mismo patrón que
 * `RegistrarCargaCombustibleModal.test.tsx`.
 */
const createMutateMock = vi.fn();
const updateMutateMock = vi.fn();
vi.mock('../../hooks/useEquipmentDocuments', () => ({
  useCreateEquipmentDocument: () => ({ mutate: createMutateMock, isPending: false }),
  useUpdateEquipmentDocument: () => ({ mutate: updateMutateMock, isPending: false }),
}));

const uploadFileMock = vi.fn();
vi.mock('../../api/UploadsAPI', () => ({
  uploadFile: (...args: unknown[]) => uploadFileMock(...args),
}));

afterEach(cleanup);

const DOCUMENTO: EquipmentDocument = {
  id: 'doc_1',
  equipmentId: 'eq_1',
  type: 'TECHNICAL_INSPECTION',
  title: 'Revisión anual',
  expiryDate: '2026-12-01T00:00:00.000Z',
  fileUrl: 'https://minio.local/signed/rt.pdf?X-Amz-Signature=vieja',
  fileName: 'revision-tecnica.pdf',
  notes: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  status: 'VIGENTE',
  daysToExpiry: 71,
};

const FILE = new File(['contenido'], 'nuevo.pdf', { type: 'application/pdf' });

function renderModal(document: EquipmentDocument | null, isOpen = true) {
  const qc = new QueryClient();
  const onOpenChange = vi.fn();
  const utils = render(
    <QueryClientProvider client={qc}>
      <EquipmentDocumentModal document={document} equipmentId="eq_1" isOpen={isOpen} onOpenChange={onOpenChange} />
    </QueryClientProvider>,
  );
  return { onOpenChange, qc, ...utils };
}

function subirArchivo() {
  const input = document.querySelector('input[type="file"]') as HTMLInputElement;
  fireEvent.change(input, { target: { files: [FILE] } });
}

beforeEach(() => {
  uploadFileMock.mockReset();
  uploadFileMock.mockResolvedValue({ key: 'tmp/u1/nuevo.pdf', url: 'https://minio.local/nuevo.pdf' });
  createMutateMock.mockReset();
  updateMutateMock.mockReset();
});

describe('EquipmentDocumentModal — "Ver archivo actual" usa el endpoint 302, no la URL firmada cruda', () => {
  it('el link apunta a /api/equipment/documents/:id/file (sirve aunque la pestaña lleve horas abierta)', () => {
    renderModal(DOCUMENTO);

    const link = screen.getByRole('link', { name: 'Ver archivo actual' });
    expect(link.getAttribute('href')).toBe(`${env.apiUrl}/api/equipment/documents/doc_1/file`);
    expect(link.getAttribute('target')).toBe('_blank');
    expect(link.getAttribute('rel')).toBe('noopener noreferrer');
  });

  it('sin archivo adjunto, no muestra el link', () => {
    renderModal({ ...DOCUMENTO, fileUrl: null, fileName: null });

    expect(screen.queryByRole('link', { name: 'Ver archivo actual' })).toBeNull();
  });
});

describe('EquipmentDocumentModal — un refetch en segundo plano no pisa una subida pendiente ni texto sin guardar', () => {
  it('rerender con una NUEVA referencia del mismo documento (isOpen sigue true) conserva el archivo recién subido y el campo editado', async () => {
    const { rerender, qc } = renderModal(DOCUMENTO);

    subirArchivo();
    await waitFor(() => expect(uploadFileMock).toHaveBeenCalledWith(FILE));
    await waitFor(() => expect(screen.getByText('nuevo.pdf')).toBeTruthy());

    fireEvent.change(screen.getByLabelText('Título (opcional)'), {
      target: { value: 'Título editado sin guardar' },
    });
    expect((screen.getByLabelText('Título (opcional)') as HTMLInputElement).value).toBe(
      'Título editado sin guardar',
    );

    // Simula el refetch: MISMO documento (mismos valores), referencia nueva —
    // lo que entrega TanStack Query tras invalidar `['equipment-documents',
    // 'eq_1']`/`['equipment']`. El modal sigue abierto.
    const documentoRefetched: EquipmentDocument = { ...DOCUMENTO };
    rerender(
      <QueryClientProvider client={qc}>
        <EquipmentDocumentModal document={documentoRefetched} equipmentId="eq_1" isOpen onOpenChange={vi.fn()} />
      </QueryClientProvider>,
    );

    // Ni el archivo pendiente ni el texto editado se perdieron.
    expect(screen.getByText('nuevo.pdf')).toBeTruthy();
    expect(screen.queryByText('revision-tecnica.pdf')).toBeNull();
    expect((screen.getByLabelText('Título (opcional)') as HTMLInputElement).value).toBe(
      'Título editado sin guardar',
    );

    // Y viajan de verdad en el submit — confirma que `fileState` no se limpió
    // por el refetch.
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));

    await waitFor(() => expect(updateMutateMock).toHaveBeenCalledTimes(1));
    const [{ input }] = updateMutateMock.mock.calls[0] as [{ input: Record<string, unknown> }];
    expect(input.fileKey).toBe('tmp/u1/nuevo.pdf');
    expect(input.title).toBe('Título editado sin guardar');
  });
});

describe('EquipmentDocumentModal — cerrar y reabrir de verdad sí resetea', () => {
  it('la transición isOpen true→false→true descarta el archivo pendiente y el texto editado (no guardados)', async () => {
    const { rerender, qc } = renderModal(DOCUMENTO);

    subirArchivo();
    await waitFor(() => expect(uploadFileMock).toHaveBeenCalledWith(FILE));
    await waitFor(() => expect(screen.getByText('nuevo.pdf')).toBeTruthy());
    fireEvent.change(screen.getByLabelText('Título (opcional)'), {
      target: { value: 'Título editado sin guardar' },
    });

    rerender(
      <QueryClientProvider client={qc}>
        <EquipmentDocumentModal document={DOCUMENTO} equipmentId="eq_1" isOpen={false} onOpenChange={vi.fn()} />
      </QueryClientProvider>,
    );
    rerender(
      <QueryClientProvider client={qc}>
        <EquipmentDocumentModal document={DOCUMENTO} equipmentId="eq_1" isOpen onOpenChange={vi.fn()} />
      </QueryClientProvider>,
    );

    expect((screen.getByLabelText('Título (opcional)') as HTMLInputElement).value).toBe(DOCUMENTO.title);
    expect(screen.getByText('revision-tecnica.pdf')).toBeTruthy();
    expect(screen.queryByText('nuevo.pdf')).toBeNull();
  });
});
