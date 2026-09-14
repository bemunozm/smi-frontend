import { afterEach, describe, expect, it, vi } from 'vitest';

import { EquipmentAPI } from './EquipmentAPI';

// Los mocks de axios se declaran con `vi.hoisted` porque `vi.mock` se
// "hoistea" arriba de los imports — sin esto, las funciones referenciadas
// dentro del factory de `vi.mock` todavía no existirían al ejecutarse.
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

const EQUIPMENT = {
  id: 'eq_1',
  internalCode: 'EX-001',
  licensePlate: null,
  equipmentClass: 'HEAVY',
  type: 'Excavadora',
  brand: 'Caterpillar',
  model: '336',
  year: 2019,
  controlUnit: 'HOURS',
  currentHourmeter: 1200,
  currentMileage: null,
  status: 'OPERATIONAL',
  homeBranchId: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

/** Construye un error "de axios" tal como lo entrega `toDomainError`: con
 * `isAxiosError: true` y `response.data.message`, sin depender de disparar
 * una request real. */
function axiosErrorConMensaje(message: string): Error {
  return Object.assign(new Error('Request failed'), {
    isAxiosError: true,
    response: { data: { message } },
  });
}

describe('EquipmentAPI.list', () => {
  it('pide GET /api/equipment y devuelve la data ya parseada', async () => {
    getMock.mockResolvedValueOnce({ data: { data: [EQUIPMENT], message: 'ok' } });

    const result = await EquipmentAPI.list();

    expect(getMock).toHaveBeenCalledWith('/api/equipment', { params: {} });
    expect(result).toEqual([EQUIPMENT]);
  });

  it('solo manda los filtros con valor — el backend corre con forbidNonWhitelisted', async () => {
    getMock.mockResolvedValueOnce({ data: { data: [], message: 'ok' } });

    await EquipmentAPI.list({ status: 'OPERATIONAL', q: '' });

    expect(getMock).toHaveBeenCalledWith('/api/equipment', { params: { status: 'OPERATIONAL' } });
  });

  it('convierte un shape de respuesta inválido en un error de dominio legible', async () => {
    getMock.mockResolvedValueOnce({ data: { data: [{ id: 'incompleto' }], message: 'ok' } });

    await expect(EquipmentAPI.list()).rejects.toThrow(/Respuesta inválida/);
  });

  it('prioriza el mensaje del backend por sobre el mensaje técnico de axios', async () => {
    getMock.mockRejectedValueOnce(axiosErrorConMensaje('Sin permisos para ver la flota'));

    await expect(EquipmentAPI.list()).rejects.toThrow('Sin permisos para ver la flota');
  });

  it('usa el mensaje de fallback (no el técnico de axios) cuando el backend no trae uno', async () => {
    // Caída de red real: es un AxiosError, pero sin `response` (no llegó a
    // haber respuesta del backend) — `toDomainError` no debe filtrar el
    // `error.message` técnico de axios ("Network Error"), usa el fallback.
    getMock.mockRejectedValueOnce(Object.assign(new Error('Network Error'), { isAxiosError: true }));

    await expect(EquipmentAPI.list()).rejects.toThrow('No se pudo obtener la lista de equipos.');
  });
});

describe('EquipmentAPI.resumen', () => {
  it('pide GET /api/equipment/resumen y devuelve el agregado', async () => {
    const resumen = { total: 2, disponibles: 1, porEstado: { OPERATIONAL: 1, IN_WORKSHOP: 1, OUT_OF_SERVICE: 0 } };
    getMock.mockResolvedValueOnce({ data: { data: resumen, message: 'ok' } });

    const result = await EquipmentAPI.resumen();

    expect(getMock).toHaveBeenCalledWith('/api/equipment/resumen');
    expect(result).toEqual(resumen);
  });
});

describe('EquipmentAPI.getById', () => {
  it('pide GET /api/equipment/:id y devuelve la ficha', async () => {
    const detalle = {
      ...EQUIPMENT,
      homeBranch: null,
      _count: { combustibles: 0, horometros: 0, trabajosExtra: 0, hallazgos: 0, movimientos: 0 },
      movimientos: [],
    };
    getMock.mockResolvedValueOnce({ data: { data: detalle, message: 'ok' } });

    const result = await EquipmentAPI.getById('eq_1');

    expect(getMock).toHaveBeenCalledWith('/api/equipment/eq_1');
    expect(result).toEqual(detalle);
  });
});

describe('EquipmentAPI.create', () => {
  it('postea a /api/equipment y devuelve el equipo creado', async () => {
    postMock.mockResolvedValueOnce({ data: { data: EQUIPMENT, message: 'Equipo creado' } });

    const result = await EquipmentAPI.create({
      internalCode: 'EX-001',
      equipmentClass: 'HEAVY',
      type: 'Excavadora',
      brand: 'Caterpillar',
      model: '336',
      controlUnit: 'HOURS',
      status: 'OPERATIONAL',
    });

    expect(postMock).toHaveBeenCalledWith(
      '/api/equipment',
      expect.objectContaining({ internalCode: 'EX-001' }),
    );
    expect(result).toEqual(EQUIPMENT);
  });

  it('propaga el mensaje de conflicto cuando el código ya existe', async () => {
    postMock.mockRejectedValueOnce(axiosErrorConMensaje('Ya existe un equipo con el código "EX-001"'));

    await expect(
      EquipmentAPI.create({
        internalCode: 'EX-001',
        equipmentClass: 'HEAVY',
        type: 'Excavadora',
        brand: 'Caterpillar',
        model: '336',
        controlUnit: 'HOURS',
        status: 'OPERATIONAL',
      }),
    ).rejects.toThrow('Ya existe un equipo con el código "EX-001"');
  });
});

describe('EquipmentAPI.update', () => {
  it('patchea /api/equipment/:id sin el código interno', async () => {
    patchMock.mockResolvedValueOnce({ data: { data: EQUIPMENT, message: 'Equipo actualizado' } });

    const result = await EquipmentAPI.update('eq_1', {
      equipmentClass: 'HEAVY',
      type: 'Excavadora',
      brand: 'Caterpillar',
      model: '336',
      controlUnit: 'HOURS',
      status: 'OPERATIONAL',
    });

    expect(patchMock).toHaveBeenCalledWith('/api/equipment/eq_1', expect.not.objectContaining({ internalCode: expect.anything() }));
    expect(result).toEqual(EQUIPMENT);
  });
});

describe('EquipmentAPI.updateStatus', () => {
  it('patchea /api/equipment/:id/status con el body { status }', async () => {
    const actualizado = { ...EQUIPMENT, status: 'IN_WORKSHOP' };
    patchMock.mockResolvedValueOnce({ data: { data: actualizado, message: 'Estado actualizado' } });

    const result = await EquipmentAPI.updateStatus('eq_1', 'IN_WORKSHOP');

    expect(patchMock).toHaveBeenCalledWith('/api/equipment/eq_1/status', { status: 'IN_WORKSHOP' });
    expect(result.status).toBe('IN_WORKSHOP');
  });
});

describe('EquipmentAPI.remove', () => {
  it('llama DELETE /api/equipment/:id', async () => {
    deleteMock.mockResolvedValueOnce({ data: { data: { id: 'eq_1' }, message: 'Equipo eliminado' } });

    await expect(EquipmentAPI.remove('eq_1')).resolves.toBeUndefined();
    expect(deleteMock).toHaveBeenCalledWith('/api/equipment/eq_1');
  });

  it('propaga el mensaje 409 del backend cuando el equipo tiene historial asociado', async () => {
    deleteMock.mockRejectedValueOnce(
      axiosErrorConMensaje(
        'El equipo EX-001 tiene 3 registro(s) asociados y no se puede eliminar. Cámbialo a estado "Fuera de servicio".',
      ),
    );

    await expect(EquipmentAPI.remove('eq_1')).rejects.toThrow(/registro\(s\) asociados/);
  });
});
