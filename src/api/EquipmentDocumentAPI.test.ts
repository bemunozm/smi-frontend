import { afterEach, describe, expect, it, vi } from 'vitest';

import { EquipmentDocumentAPI } from './EquipmentDocumentAPI';

// Los mocks de axios se declaran con `vi.hoisted` porque `vi.mock` se
// "hoistea" arriba de los imports — mismo criterio que `EquipmentAPI.test.ts`.
const { getMock, postMock, patchMock, deleteMock } = vi.hoisted(() => ({
  getMock: vi.fn(),
  postMock: vi.fn(),
  patchMock: vi.fn(),
  deleteMock: vi.fn(),
}));

vi.mock('../lib/axios', () => ({
  axiosInstance: {
    get: getMock,
    post: postMock,
    patch: patchMock,
    delete: deleteMock,
  },
}));

afterEach(() => {
  vi.clearAllMocks();
});

const DOCUMENTO = {
  id: 'doc_1',
  equipmentId: 'eq_1',
  type: 'TECHNICAL_INSPECTION',
  title: 'Revisión anual',
  expiryDate: '2026-12-01T00:00:00.000Z',
  fileUrl: '/uploads/rt.pdf',
  fileName: 'revision-tecnica.pdf',
  notes: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  status: 'VIGENTE',
  daysToExpiry: 71,
};

/** Construye un error "de axios" tal como lo entrega `toDomainError`: con
 * `isAxiosError: true` y `response.data.message`, sin depender de disparar
 * una request real — mismo helper que `EquipmentAPI.test.ts`. */
function axiosErrorConMensaje(message: string): Error {
  return Object.assign(new Error('Request failed'), {
    isAxiosError: true,
    response: { data: { message } },
  });
}

describe('EquipmentDocumentAPI.list', () => {
  it('pide GET /api/equipment/:equipmentId/documents y devuelve la data ya parseada', async () => {
    getMock.mockResolvedValueOnce({ data: { data: [DOCUMENTO], message: 'ok' } });

    const result = await EquipmentDocumentAPI.list('eq_1');

    expect(getMock).toHaveBeenCalledWith('/api/equipment/eq_1/documents');
    expect(result).toEqual([DOCUMENTO]);
  });

  it('convierte un shape de respuesta inválido en un error de dominio legible', async () => {
    getMock.mockResolvedValueOnce({ data: { data: [{ id: 'incompleto' }], message: 'ok' } });

    await expect(EquipmentDocumentAPI.list('eq_1')).rejects.toThrow(/Respuesta inválida/);
  });

  it('prioriza el mensaje del backend por sobre el mensaje técnico de axios', async () => {
    getMock.mockRejectedValueOnce(axiosErrorConMensaje('Sin permisos para ver los documentos'));

    await expect(EquipmentDocumentAPI.list('eq_1')).rejects.toThrow('Sin permisos para ver los documentos');
  });
});

describe('EquipmentDocumentAPI.create', () => {
  it('postea a /api/equipment/:equipmentId/documents y devuelve el documento creado', async () => {
    postMock.mockResolvedValueOnce({ data: { data: DOCUMENTO, message: 'Documento creado' } });

    const result = await EquipmentDocumentAPI.create('eq_1', { type: 'TECHNICAL_INSPECTION' });

    expect(postMock).toHaveBeenCalledWith('/api/equipment/eq_1/documents', { type: 'TECHNICAL_INSPECTION' });
    expect(result).toEqual(DOCUMENTO);
  });

  it('propaga el mensaje del backend cuando la creación falla', async () => {
    postMock.mockRejectedValueOnce(axiosErrorConMensaje('type es requerido'));

    await expect(EquipmentDocumentAPI.create('eq_1', { type: 'OTHER' })).rejects.toThrow('type es requerido');
  });
});

describe('EquipmentDocumentAPI.update', () => {
  it('patchea /api/equipment/documents/:id (sin equipmentId en la ruta)', async () => {
    const actualizado = { ...DOCUMENTO, title: 'Revisión anual (renovada)' };
    patchMock.mockResolvedValueOnce({ data: { data: actualizado, message: 'Documento actualizado' } });

    const result = await EquipmentDocumentAPI.update('doc_1', { title: 'Revisión anual (renovada)' });

    expect(patchMock).toHaveBeenCalledWith('/api/equipment/documents/doc_1', {
      title: 'Revisión anual (renovada)',
    });
    expect(result.title).toBe('Revisión anual (renovada)');
  });
});

describe('EquipmentDocumentAPI.remove', () => {
  it('llama DELETE /api/equipment/documents/:id', async () => {
    deleteMock.mockResolvedValueOnce({ data: { data: { id: 'doc_1' }, message: 'Documento eliminado' } });

    await expect(EquipmentDocumentAPI.remove('doc_1')).resolves.toBeUndefined();
    expect(deleteMock).toHaveBeenCalledWith('/api/equipment/documents/doc_1');
  });

  it('propaga el mensaje del backend cuando el borrado falla', async () => {
    deleteMock.mockRejectedValueOnce(axiosErrorConMensaje('No tienes permiso para eliminar este documento'));

    await expect(EquipmentDocumentAPI.remove('doc_1')).rejects.toThrow('No tienes permiso para eliminar este documento');
  });
});
