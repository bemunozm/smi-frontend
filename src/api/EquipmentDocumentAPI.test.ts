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

