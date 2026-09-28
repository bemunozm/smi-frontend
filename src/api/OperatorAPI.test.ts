import { afterEach, describe, expect, it, vi } from 'vitest';

import { OperatorAPI } from './OperatorAPI';

// `vi.hoisted` porque `vi.mock` se "hoistea" arriba de los imports — mismo
// patrón que `BranchAPI.test.ts`/`EquipmentAPI.test.ts`.
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

const OPERATOR = {
  id: 'op_1',
  name: 'Juan Rojas',
  rut: '12345678-5',
  isActive: true,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

/** Error "de axios" tal como lo entrega `toDomainError` — ver `BranchAPI.test.ts`. */
function axiosErrorConMensaje(message: string): Error {
  return Object.assign(new Error('Request failed'), {
    isAxiosError: true,
    response: { data: { message } },
  });
}

describe('OperatorAPI.list', () => {
  it('pide GET /api/operators y devuelve la data ya parseada', async () => {
    getMock.mockResolvedValueOnce({ data: { data: [OPERATOR], message: 'ok' } });

    const result = await OperatorAPI.list();

    expect(getMock).toHaveBeenCalledWith('/api/operators', { params: {} });
    expect(result).toEqual([OPERATOR]);
  });

  it('manda `isActive: false` como filtro (es un valor válido, no se omite por falsy)', async () => {
    getMock.mockResolvedValueOnce({ data: { data: [], message: 'ok' } });

    await OperatorAPI.list({ isActive: false });

    expect(getMock).toHaveBeenCalledWith('/api/operators', { params: { isActive: false } });
  });

  it('manda el filtro `q` cuando viene', async () => {
    getMock.mockResolvedValueOnce({ data: { data: [], message: 'ok' } });

    await OperatorAPI.list({ isActive: true, q: 'Juan' });

    expect(getMock).toHaveBeenCalledWith('/api/operators', { params: { isActive: true, q: 'Juan' } });
  });

  it('convierte un shape de respuesta inválido en un error de dominio legible (Zod)', async () => {
    getMock.mockResolvedValueOnce({ data: { data: [{ id: 'incompleto' }], message: 'ok' } });

    await expect(OperatorAPI.list()).rejects.toThrow(/Respuesta inválida/);
  });

  it('prioriza el mensaje del backend por sobre el mensaje técnico de axios', async () => {
    getMock.mockRejectedValueOnce(axiosErrorConMensaje('Sin permisos para ver los operadores'));

    await expect(OperatorAPI.list()).rejects.toThrow('Sin permisos para ver los operadores');
  });
});

describe('OperatorAPI.create', () => {
  it('postea a /api/operators y devuelve el operador creado', async () => {
    postMock.mockResolvedValueOnce({ data: { data: OPERATOR, message: 'Operador creado' } });

    const result = await OperatorAPI.create({ name: 'Juan Rojas', rut: '12345678-5' });

    expect(postMock).toHaveBeenCalledWith('/api/operators', { name: 'Juan Rojas', rut: '12345678-5' });
    expect(result).toEqual(OPERATOR);
  });

  it('propaga el mensaje de conflicto cuando el RUT ya existe', async () => {
    postMock.mockRejectedValueOnce(axiosErrorConMensaje('Ya existe un operador con el RUT "12345678-5"'));

    await expect(OperatorAPI.create({ name: 'Juan Rojas', rut: '12345678-5' })).rejects.toThrow(
      'Ya existe un operador con el RUT "12345678-5"',
    );
  });
});

describe('OperatorAPI.update', () => {
  it('patchea /api/operators/:id y devuelve el operador actualizado', async () => {
    const actualizado = { ...OPERATOR, isActive: false };
    patchMock.mockResolvedValueOnce({ data: { data: actualizado, message: 'Operador actualizado' } });

    const result = await OperatorAPI.update('op_1', { isActive: false });

    expect(patchMock).toHaveBeenCalledWith('/api/operators/op_1', { isActive: false });
    expect(result).toEqual(actualizado);
  });
});

describe('OperatorAPI.remove', () => {
  it('llama DELETE /api/operators/:id', async () => {
    deleteMock.mockResolvedValueOnce({ data: { data: { id: 'op_1' }, message: 'Operador eliminado' } });

    await OperatorAPI.remove('op_1');

    expect(deleteMock).toHaveBeenCalledWith('/api/operators/op_1');
  });

  it('propaga el 409 cuando el operador está en uso', async () => {
    deleteMock.mockRejectedValueOnce(
      axiosErrorConMensaje('El operador "Juan Rojas" tiene 3 registro(s) asociados y no se puede eliminar.'),
    );

    await expect(OperatorAPI.remove('op_1')).rejects.toThrow(/no se puede eliminar/);
  });
});
