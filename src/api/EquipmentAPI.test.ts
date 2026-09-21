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
  photoUrl: null,
  technicalInspectionExpiry: null,
  insuranceExpiry: null,
  operator: null,
  supervisor: null,
  inUse: false,
  currentFuelLevel: null,
  openShift: null,
  documents: {
    technicalInspection: { expiry: null, status: 'SIN_DATO', daysToExpiry: null },
    insurance: { expiry: null, status: 'SIN_DATO', daysToExpiry: null },
  },
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

  it('parsea un equipo con turno de horómetro abierto (`openShift`, flujo de dos pasos)', async () => {
    const conTurnoAbierto = {
      ...EQUIPMENT,
      openShift: {
        id: 'h_abierto',
        valorInicial: 1200,
        operador: 'Carlos Núñez',
        turno: 'NOCTURNO',
        fecha: '2026-08-06T20:00:00.000Z',
      },
    };
    getMock.mockResolvedValueOnce({ data: { data: [conTurnoAbierto], message: 'ok' } });

    const result = await EquipmentAPI.list();

    expect(result).toEqual([conTurnoAbierto]);
  });

  // R1/R2: `documents` es el shape derivado on-read que arma
  // `equipment.service.ts#buildDocumentExpiryInfo` — confirmado contra el
  // código del backend (no inventado), mismo criterio que el test de
  // `openShift` de arriba: prueba que el zod real acepta el contrato tal
  // cual lo entrega `equipment.service.ts`.
  it('parsea un equipo con vencimientos de revisión técnica y seguro cargados (R1/R2)', async () => {
    const conDocumentos = {
      ...EQUIPMENT,
      technicalInspectionExpiry: '2026-12-01T00:00:00.000Z',
      insuranceExpiry: '2027-01-15T00:00:00.000Z',
      documents: {
        technicalInspection: { expiry: '2026-12-01T00:00:00.000Z', status: 'VIGENTE', daysToExpiry: 71 },
        insurance: { expiry: '2027-01-15T00:00:00.000Z', status: 'VIGENTE', daysToExpiry: 116 },
      },
    };
    getMock.mockResolvedValueOnce({ data: { data: [conDocumentos], message: 'ok' } });

    const result = await EquipmentAPI.list();

    expect(result).toEqual([conDocumentos]);
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
      _count: { combustibles: 0, horometros: 0, trabajosExtra: 0, hallazgos: 0, stockMovements: 0 },
      stockMovements: [],
    };
    getMock.mockResolvedValueOnce({ data: { data: detalle, message: 'ok' } });

    const result = await EquipmentAPI.getById('eq_1');

    expect(getMock).toHaveBeenCalledWith('/api/equipment/eq_1');
    expect(result).toEqual(detalle);
  });

  it('parsea el shape REAL de un stockMovement (Inventario en inglés, sin item.id) sin lanzar', async () => {
    // Fixture tomada tal cual de `GET /api/equipment/:id` contra el backend
    // en vivo (2026-09-14) — no inventada. Esta prueba existe para que un
    // futuro cambio de shape en `equipment.service.ts#findOne` (o un drift
    // silencioso como el que rompió la ficha) truene ACÁ, contra el zod real,
    // en vez de pasar inadvertido porque los tests de componentes seedean el
    // query cache directo (bypasean `EquipmentDetailResponseSchema.parse`).
    const detalle = {
      ...EQUIPMENT,
      homeBranch: null,
      _count: { combustibles: 1, horometros: 1, trabajosExtra: 0, hallazgos: 0, stockMovements: 2 },
      stockMovements: [
        {
          id: 'cmu1l371q0029gc9oh1w155qu',
          itemId: 'cmu1l371h0023gc9o88v9u3t9',
          branchId: 'cmu1l36yf0000gc9or4flnzrp',
          direction: 'OUT',
          reason: 'INTERVENTION',
          quantity: 4,
          resultingBalance: 2,
          reference: null,
          documentNumber: null,
          sourceBranchId: null,
          destinationBranchId: null,
          performedById: 'uOWvhyBv6Ir39b949hWib447vHqAjXqG',
          equipmentId: 'cmu1l36yz000fgc9oy8pl31vo',
          notes: 'Consumo en mantención de CG-002',
          occurredAt: '2026-09-14T18:36:07.406Z',
          item: { sku: 'NEU-001', name: 'Neumático 29.5R25', unit: 'UNIT' },
        },
      ],
    };
    getMock.mockResolvedValueOnce({ data: { data: detalle, message: 'ok' } });

    const result = await EquipmentAPI.getById('eq_1');

    expect(result.stockMovements[0]?.item).toEqual({ sku: 'NEU-001', name: 'Neumático 29.5R25', unit: 'UNIT' });
    expect(result._count.stockMovements).toBe(2);
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

describe('EquipmentAPI.assign', () => {
  it('patchea /api/equipment/:id/assignment con el body de asignación', async () => {
    const asignado = { ...EQUIPMENT, operator: { id: 'u_op', name: 'Pedro Soto' } };
    patchMock.mockResolvedValueOnce({ data: { data: asignado, message: 'Asignación actualizada' } });

    const result = await EquipmentAPI.assign('eq_1', { operatorId: 'u_op', supervisorId: null });

    expect(patchMock).toHaveBeenCalledWith('/api/equipment/eq_1/assignment', {
      operatorId: 'u_op',
      supervisorId: null,
    });
    expect(result.operator).toEqual({ id: 'u_op', name: 'Pedro Soto' });
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
