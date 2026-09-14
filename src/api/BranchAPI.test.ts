import { afterEach, describe, expect, it, vi } from 'vitest';

import { BranchAPI } from './BranchAPI';

// `vi.hoisted` porque `vi.mock` se "hoistea" arriba de los imports — sin esto
// las funciones referenciadas en el factory todavía no existirían al
// ejecutarse. Mismo patrón que `EquipmentAPI.test.ts`.
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

const BRANCH = {
  id: 'br_1',
  name: 'Sucursal Centro',
  address: 'Av. Siempre Viva 123',
  isActive: true,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

/** Error "de axios" tal como lo entrega `toDomainError` — ver `EquipmentAPI.test.ts`. */
function axiosErrorConMensaje(message: string): Error {
  return Object.assign(new Error('Request failed'), {
    isAxiosError: true,
    response: { data: { message } },
  });
}

describe('BranchAPI.list', () => {
  it('pide GET /api/branches y devuelve la data ya parseada', async () => {
    getMock.mockResolvedValueOnce({ data: { data: [BRANCH], message: 'ok' } });

    const result = await BranchAPI.list();

    expect(getMock).toHaveBeenCalledWith('/api/branches', { params: {} });
    expect(result).toEqual([BRANCH]);
  });

  it('manda `isActive: false` como filtro (es un valor válido, no se omite por falsy)', async () => {
    getMock.mockResolvedValueOnce({ data: { data: [], message: 'ok' } });

    await BranchAPI.list({ isActive: false });

    expect(getMock).toHaveBeenCalledWith('/api/branches', { params: { isActive: false } });
  });

  it('convierte un shape de respuesta inválido en un error de dominio legible (Zod)', async () => {
    getMock.mockResolvedValueOnce({ data: { data: [{ id: 'incompleto' }], message: 'ok' } });

    await expect(BranchAPI.list()).rejects.toThrow(/Respuesta inválida/);
  });

  it('prioriza el mensaje del backend por sobre el mensaje técnico de axios', async () => {
    getMock.mockRejectedValueOnce(axiosErrorConMensaje('Sin permisos para ver las sucursales'));

    await expect(BranchAPI.list()).rejects.toThrow('Sin permisos para ver las sucursales');
  });
});

describe('BranchAPI.create', () => {
  it('postea a /api/branches y devuelve la sucursal creada', async () => {
    postMock.mockResolvedValueOnce({ data: { data: BRANCH, message: 'Sucursal creada' } });

    const result = await BranchAPI.create({ name: 'Sucursal Centro', address: 'Av. Siempre Viva 123' });

    expect(postMock).toHaveBeenCalledWith(
      '/api/branches',
      expect.objectContaining({ name: 'Sucursal Centro' }),
    );
    expect(result).toEqual(BRANCH);
  });

  it('propaga el mensaje de conflicto cuando el nombre ya existe', async () => {
    postMock.mockRejectedValueOnce(axiosErrorConMensaje('Ya existe una sucursal con ese nombre'));

    await expect(BranchAPI.create({ name: 'Sucursal Centro' })).rejects.toThrow(
      'Ya existe una sucursal con ese nombre',
    );
  });
});
