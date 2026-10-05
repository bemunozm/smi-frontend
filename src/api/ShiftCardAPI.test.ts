import { afterEach, describe, expect, it, vi } from 'vitest';

import { ShiftCardAPI } from './ShiftCardAPI';
import { DomainError } from '../lib/api-error';

const { getMock, postMock } = vi.hoisted(() => ({
  getMock: vi.fn(),
  postMock: vi.fn(),
}));

vi.mock('../lib/axios', () => ({
  axiosInstance: { get: getMock, post: postMock },
}));

afterEach(() => {
  vi.clearAllMocks();
});

const CARD = {
  id: 'c1',
  equipoId: 'eq_1',
  equipo: { internalCode: 'EX-005', type: 'Excavadora', controlUnit: 'HOURS' },
  operatorId: 'op_1',
  operatorName: 'Patricio Rojas',
  supervisorId: 'u1',
  supervisorName: 'Ana Soto',
  shift: {
    id: 'sh_1',
    date: '2026-09-24',
    type: 'DIURNO',
    exitReports: [],
  },
  valorInicial: 100,
  valorFinal: null,
  horasMaquina: null,
  fuelLiters: null,
  pumpPhotoUrl: null,
  observaciones: null,
  adBlue: false,
  adBlueLiters: null,
  belowPreviousReading: false,
  fecha: '2026-09-24T08:00:00.000Z',
  fechaSalida: null,
  createdAt: '2026-09-24T08:00:00.000Z',
  closedAt: null,
};

/** Error "de axios" tal como lo entrega el backend con `code` — mismo
 * helper que `OperatorAPI.test.ts`, extendido con `code`/`status`. */
function axiosError(status: number, message: string, code?: string): Error {
  return Object.assign(new Error('Request failed'), {
    isAxiosError: true,
    response: { status, data: { message, ...(code ? { code } : {}) } },
  });
}

describe('ShiftCardAPI.openCard', () => {
  it('postea a /api/shift-cards y devuelve la tarjeta ya parseada', async () => {
    postMock.mockResolvedValueOnce({ data: { data: CARD, message: 'Tarjeta abierta' } });

    const input = {
      id: 'c1',
      equipoId: 'eq_1',
      operatorId: 'op_1',
      valorInicial: 100,
      shiftDate: '2026-09-24',
      shiftType: 'DIURNO' as const,
      capturedAt: '2026-09-24T08:00:00.000Z',
    };
    const result = await ShiftCardAPI.openCard(input);

    // Tercer arg `undefined`: el `config` opcional (replay offline — ver
    // `offline/replay.ts`) que acá no se manda.
    expect(postMock).toHaveBeenCalledWith('/api/shift-cards', input, undefined);
    expect(result).toEqual(CARD);
  });

  it('con un `config` (timeout/headers del replay offline), lo pasa tal cual a axios', async () => {
    postMock.mockResolvedValueOnce({ data: { data: CARD, message: 'Tarjeta abierta' } });
    const input = {
      id: 'c1',
      equipoId: 'eq_1',
      operatorId: 'op_1',
      valorInicial: 100,
      shiftDate: '2026-09-24',
      shiftType: 'DIURNO' as const,
      capturedAt: '2026-09-24T08:00:00.000Z',
    };
    const config = { timeout: 20_000, headers: { 'X-Client-Time': '2026-09-24T08:05:00.000Z' } };

    await ShiftCardAPI.openCard(input, config);

    expect(postMock).toHaveBeenCalledWith('/api/shift-cards', input, config);
  });

  it('propaga el `code` del backend en el error (EQUIPMENT_BUSY)', async () => {
    postMock.mockRejectedValueOnce(
      axiosError(409, 'CA-011 está ocupado por Marcela Pizarro desde las 07:40', 'EQUIPMENT_BUSY'),
    );

    const input = {
      id: 'c1',
      equipoId: 'eq_1',
      operatorId: 'op_1',
      valorInicial: 100,
      shiftDate: '2026-09-24',
      shiftType: 'DIURNO' as const,
      capturedAt: '2026-09-24T08:00:00.000Z',
    };

    await expect(ShiftCardAPI.openCard(input)).rejects.toMatchObject({
      message: 'CA-011 está ocupado por Marcela Pizarro desde las 07:40',
      code: 'EQUIPMENT_BUSY',
      status: 409,
    });
  });

  it('sin `code` explícito, el error queda sin code (fallback amigable si tampoco hay message)', async () => {
    postMock.mockRejectedValueOnce(Object.assign(new Error('Network Error'), { isAxiosError: true }));

    let error: DomainError | undefined;
    try {
      await ShiftCardAPI.openCard({
        id: 'c1',
        equipoId: 'eq_1',
        operatorId: 'op_1',
        valorInicial: 100,
        shiftDate: '2026-09-24',
        shiftType: 'DIURNO',
        capturedAt: '2026-09-24T08:00:00.000Z',
      });
    } catch (e: unknown) {
      error = e as DomainError;
    }

    expect(error).toBeInstanceOf(DomainError);
    expect(error?.code).toBeUndefined();
    expect(error?.message).toBe('No se pudo abrir la tarjeta de turno.');
  });

  it('convierte un shape de respuesta inválido en un error de dominio legible (Zod)', async () => {
    postMock.mockResolvedValueOnce({ data: { data: { id: 'incompleto' }, message: 'ok' } });

    await expect(
      ShiftCardAPI.openCard({
        id: 'c1',
        equipoId: 'eq_1',
        operatorId: 'op_1',
        valorInicial: 100,
        shiftDate: '2026-09-24',
        shiftType: 'DIURNO',
        capturedAt: '2026-09-24T08:00:00.000Z',
      }),
    ).rejects.toThrow(/Respuesta inválida/);
  });
});

describe('ShiftCardAPI.closeCard', () => {
  it('postea a /api/shift-cards/:id/close y devuelve la tarjeta cerrada', async () => {
    const cerrada = { ...CARD, valorFinal: 130, closedAt: '2026-09-24T16:00:00.000Z' };
    postMock.mockResolvedValueOnce({ data: { data: cerrada, message: 'Tarjeta cerrada' } });

    const input = {
      closeClientId: 'close-1',
      valorFinal: 130,
      fuelLiters: 20,
      tmpPhotoKey: 'tmp/u1/foto.jpg',
      capturedAt: '2026-09-24T16:00:00.000Z',
    };
    const result = await ShiftCardAPI.closeCard('c1', input);

    expect(postMock).toHaveBeenCalledWith('/api/shift-cards/c1/close', input, undefined);
    expect(result.valorFinal).toBe(130);
  });

  it('propaga `code` ALREADY_CLOSED', async () => {
    postMock.mockRejectedValueOnce(axiosError(409, 'La tarjeta ya estaba cerrada', 'ALREADY_CLOSED'));

    await expect(
      ShiftCardAPI.closeCard('c1', {
        closeClientId: 'close-1',
        valorFinal: 130,
        fuelLiters: 20,
        tmpPhotoKey: 'tmp/u1/foto.jpg',
        capturedAt: '2026-09-24T16:00:00.000Z',
      }),
    ).rejects.toMatchObject({ code: 'ALREADY_CLOSED' });
  });
});

describe('ShiftCardAPI.listMine', () => {
  it('pide GET /api/shift-cards/mine y devuelve la lista parseada', async () => {
    getMock.mockResolvedValueOnce({ data: { data: [CARD], message: 'ok' } });

    const result = await ShiftCardAPI.listMine();

    expect(getMock).toHaveBeenCalledWith('/api/shift-cards/mine');
    expect(result).toEqual([CARD]);
  });

  it('prioriza el mensaje del backend por sobre el mensaje técnico de axios', async () => {
    getMock.mockRejectedValueOnce(axiosError(403, 'Sin permisos para ver tus tarjetas'));

    await expect(ShiftCardAPI.listMine()).rejects.toThrow('Sin permisos para ver tus tarjetas');
  });
});
