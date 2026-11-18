import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';

const { submitWriteMock, enqueueCloseCardMock, toastDangerMock, photo } = vi.hoisted(() => ({
  submitWriteMock: vi.fn(),
  enqueueCloseCardMock: vi.fn(),
  toastDangerMock: vi.fn(),
  photo: { file: null as File | null, captureDate: null as Date | null },
}));

vi.mock('@heroui/react', () => ({ toast: { danger: toastDangerMock, success: vi.fn() } }));
vi.mock('../offline/submit-write', () => ({ submitWrite: submitWriteMock }));
vi.mock('../offline/outbox', () => ({ enqueueCloseCard: enqueueCloseCardMock }));
vi.mock('../lib/usePhotoCaptureFlow', () => ({
  usePhotoCaptureFlow: () => ({
    file: photo.file,
    isReadingPhoto: false,
    captureDate: photo.captureDate,
    ocr: null,
    handleSelectPhoto: vi.fn(),
    handleClearPhoto: vi.fn(),
    resetPhoto: vi.fn(),
  }),
}));

import {
  errorFinalBajoCarga,
  errorInicialSobreCarga,
  kmDeCargas,
  litrosTotales,
  mapCardToTarjeta,
  type CargaTarjeta,
  type TarjetaTurno,
} from './shift-register-helpers';
import { useCargaLiviano } from './useCargaLiviano';
import { useCierreForm } from './useCierreForm';
import { useShiftProjection } from './useShiftProjection';
import { contextoTurno } from '../lib/turno';
import type { HttpWriteOp } from '../offline/db';
import type { JsonObject } from '../types/json';
import type { Equipment } from '../types/equipment';
import type { ShiftCardResponse } from '../types/shift';

const CTX = contextoTurno(new Date(2026, 10, 18, 10, 0));

const CARGAS: CargaTarjeta[] = [
  { id: 'k1', litros: 70, km: 45_300, fechaIso: '2026-11-18T12:00:00.000Z', por: 'Marta Díaz' },
  { id: 'k2', litros: 40.5, km: 45_600, fechaIso: '2026-11-18T15:00:00.000Z', sinSincronizar: true },
];

const LIVIANO: TarjetaTurno = {
  id: 'card-1',
  equipoId: 'l1',
  equipo: 'CN-007',
  tipo: 'Camioneta',
  operador: 'Sin conductor',
  inicial: 45_000,
  grupo: 'actual',
  estado: 'curso',
  supervisor: 'Marta Díaz',
  liviano: true,
};

const PESADO: TarjetaTurno = { ...LIVIANO, id: 'card-2', equipo: 'EX-005', tipo: 'Excavadora', liviano: false };

const EQUIPOS = [
  { id: 'l1', internalCode: 'CN-007', type: 'Camioneta', equipmentClass: 'LIGHT', currentMileage: 45_150 },
] as unknown as Equipment[];

function cardServidor(overrides: Partial<ShiftCardResponse> = {}): ShiftCardResponse {
  return {
    id: 'card-1',
    equipoId: 'l1',
    equipo: { internalCode: 'CN-007', type: 'Camioneta', controlUnit: 'KM', equipmentClass: 'LIGHT' },
    operatorId: null,
    operatorName: '',
    supervisorId: 'u2',
    supervisorName: 'Marta Díaz',
    shift: { id: 'sh-1', date: '2026-11-18', type: 'DIURNO', exitReports: [] },
    valorInicial: 45_000,
    valorFinal: null,
    horasMaquina: null,
    fuelLiters: null,
    adBlue: false,
    adBlueLiters: null,
    pumpPhotoUrl: null,
    observaciones: null,
    belowPreviousReading: false,
    fecha: '2026-11-18T09:00:00.000Z',
    fechaSalida: null,
    createdAt: '2026-11-18T09:00:00.000Z',
    closedAt: null,
    fuelLoads: [
      {
        id: 'k1',
        liters: 70,
        reading: 45_300,
        adBlueLiters: 5,
        pumpPhotoUrl: 'https://firmada',
        fecha: '2026-11-18',
        createdAt: '2026-11-18T12:00:00.000Z',
        createdByName: 'Marta Díaz',
      },
    ],
    ...overrides,
  };
}

function opCarga(body: JsonObject, overrides: Partial<HttpWriteOp> = {}): HttpWriteOp {
  return {
    id: 'op-carga',
    type: 'httpWrite',
    v: 1,
    userId: 'u1',
    status: 'pending_upload',
    attempts: 0,
    seq: 1,
    createdAt: 1,
    updatedAt: 1,
    endpoint: 'shiftCard.fuelLoad',
    params: { id: 'card-1' },
    body,
    files: [{ field: 'tmpPhotoKey', blobId: 'b1' }],
    label: 'Carga de combustible · CN-007',
    ...overrides,
  };
}

afterEach(() => {
  vi.clearAllMocks();
  photo.file = null;
  photo.captureDate = null;
});

describe('helpers de cargas sin cerrar', () => {
  it('litrosTotales suma las cargas y la del cierre, sin duplicar', () => {
    expect(litrosTotales({ litros: undefined, cargas: CARGAS })).toBe(110.5);
    expect(litrosTotales({ litros: 20, cargas: CARGAS })).toBe(130.5);
    expect(litrosTotales({ litros: 20 })).toBe(20);
    expect(litrosTotales({ litros: undefined })).toBeUndefined();
  });

  it('el km final no puede quedar bajo la carga más alta, ni el inicial sobre la más baja', () => {
    expect(kmDeCargas({ cargas: CARGAS })).toEqual({ min: 45_300, max: 45_600 });
    expect(kmDeCargas({})).toBeNull();
    expect(errorFinalBajoCarga({ cargas: CARGAS }, 45_500)).toMatch(/45\.600 km/);
    expect(errorFinalBajoCarga({ cargas: CARGAS }, 45_600)).toBeNull();
    expect(errorFinalBajoCarga({}, 1)).toBeNull();
    expect(errorInicialSobreCarga({ cargas: CARGAS }, 45_301)).toMatch(/45\.300 km/);
    expect(errorInicialSobreCarga({ cargas: CARGAS }, 45_300)).toBeNull();
  });

  it('las cargas rechazadas no suman litros ni fijan km', () => {
    const conRechazada = [...CARGAS, { id: 'k3', litros: 500, km: 99_000, fechaIso: 'x', requiereAtencion: true }];
    expect(litrosTotales({ litros: undefined, cargas: conRechazada })).toBe(110.5);
    expect(kmDeCargas({ cargas: conRechazada })).toEqual({ min: 45_300, max: 45_600 });
    expect(kmDeCargas({ cargas: [{ ...CARGAS[0]!, requiereAtencion: true }] })).toBeNull();
  });

  it('mapCardToTarjeta trae las cargas del servidor; sin cargas no agrega el campo', () => {
    const t = mapCardToTarjeta(cardServidor(), CTX);
    expect(t.cargas).toEqual([
      { id: 'k1', litros: 70, km: 45_300, adBlueLitros: 5, fechaIso: '2026-11-18T12:00:00.000Z', por: 'Marta Díaz' },
    ]);
    expect(t.litros).toBeUndefined();
    expect(mapCardToTarjeta(cardServidor({ fuelLoads: [] }), CTX)).not.toHaveProperty('cargas');
    expect(mapCardToTarjeta(cardServidor({ fuelLoads: undefined }), CTX)).not.toHaveProperty('cargas');
  });
});

describe('useShiftProjection — cargas pendientes', () => {
  const proyectar = (ops: HttpWriteOp[], tarjetas = [cardServidor()]) =>
    renderHook(() =>
      useShiftProjection({
        ctx: CTX,
        equipos: EQUIPOS,
        operadores: [],
        tarjetasServidor: tarjetas,
        ops,
        supervisor: 'Ana Soto',
        userId: 'u1',
      }),
    ).result.current;

  it('una carga en la cola se suma a la tarjeta, marcada sin sincronizar y a nombre de quien la registró', () => {
    const p = proyectar([
      opCarga({ id: 'k2', liters: 40, reading: 45_600, adBlueLiters: 3, capturedAt: '2026-11-18T15:00:00.000Z' }),
    ]);

    const t = p.livianosAbiertos[0]!;
    expect(t.estado).toBe('curso');
    expect(t.sinSincronizar).toBeUndefined();
    expect(t.cargas).toHaveLength(2);
    expect(t.cargas![1]).toMatchObject({
      id: 'k2',
      litros: 40,
      km: 45_600,
      adBlueLitros: 3,
      por: 'Ana Soto',
      sinSincronizar: true,
      requiereAtencion: false,
    });
    expect(litrosTotales(t)).toBe(110);
  });

  it('si el servidor ya trae esa carga, no se duplica', () => {
    const p = proyectar([opCarga({ id: 'k1', liters: 70, reading: 45_300, capturedAt: '2026-11-18T12:00:00.000Z' })]);
    expect(p.livianosAbiertos[0]!.cargas).toHaveLength(1);
  });

  it('una carga rechazada por el servidor queda marcada para atención', () => {
    const p = proyectar([
      opCarga({ id: 'k2', liters: 40, reading: 45_600, capturedAt: 'x' }, { status: 'needs_attention' }),
    ]);
    expect(p.livianosAbiertos[0]!.cargas![1]).toMatchObject({ requiereAtencion: true });
  });

  it('las cargas de otra tarjeta no se mezclan', () => {
    const p = proyectar([opCarga({ id: 'k2', liters: 40, reading: 45_600 }, { params: { id: 'otra' } })]);
    expect(p.livianosAbiertos[0]!.cargas).toHaveLength(1);
  });
});

describe('useCierreForm — liviano que ya cargó sin cerrar', () => {
  const cierre = (t: TarjetaTurno) => {
    const hook = renderHook(() => useCierreForm({ tarjetas: [t], ctx: CTX, userId: 'u1' }));
    act(() => hook.result.current.abrirCierre(t.id));
    return hook;
  };

  it('con cargas previas cierra solo con km: sin litros, foto, AdBlue ni motivo en el cierre encolado', async () => {
    const { result } = cierre({ ...LIVIANO, cargas: CARGAS });
    // Aunque quedara algo escrito, no se pide ni se manda.
    act(() => result.current.setCierre((c) => ({ ...c, final: '45700', litros: '30', observaciones: 'ok' })));

    expect(result.current.cargasPrevias).toBe(2);
    expect(result.current.soloKm).toBe(true);
    expect(result.current.motivoRequerido).toBe(false);
    expect(result.current.faltaMotivo).toBe(false);
    expect(result.current.fotoRequerida).toBe(false);

    await act(() => result.current.cerrar());
    expect(enqueueCloseCardMock).toHaveBeenCalledTimes(1);
    const [, cardId, input, foto] = enqueueCloseCardMock.mock.calls[0]!;
    expect(cardId).toBe('card-1');
    expect(input).toMatchObject({ valorFinal: 45_700, observaciones: 'ok' });
    for (const campo of ['fuelLiters', 'adBlue', 'adBlueLiters', 'noFuelReason', 'photoCapturedAt']) {
      expect(input[campo]).toBeUndefined();
    }
    expect(foto).toBeNull();
  });

  it('sin cargas previas, la regla de siempre: sin litros pide el motivo y manda fuelLiters', async () => {
    const { result } = cierre(LIVIANO);
    expect(result.current.cargasPrevias).toBe(0);
    expect(result.current.soloKm).toBe(false);
    expect(result.current.motivoRequerido).toBe(true);
    expect(result.current.faltaMotivo).toBe(true);

    act(() => result.current.setCierre((c) => ({ ...c, final: '45100', motivoSinCarga: 'Corte de luz' })));
    await act(() => result.current.cerrar());
    expect(enqueueCloseCardMock.mock.calls[0]![2]).toMatchObject({ fuelLiters: 0, noFuelReason: 'Corte de luz' });
  });

  it('una carga rechazada por el servidor no cuenta: con solo esa, sigue pidiendo la carga o el motivo', () => {
    const { result } = cierre({ ...LIVIANO, cargas: [{ ...CARGAS[0]!, requiereAtencion: true }] });
    act(() => result.current.setCierre((c) => ({ ...c, final: '45100' })));

    expect(result.current.cargasPrevias).toBe(0);
    expect(result.current.soloKm).toBe(false);
    expect(result.current.motivoRequerido).toBe(true);
    expect(result.current.faltaMotivo).toBe(true);
    // Tampoco fija un km mínimo para el final.
    expect(result.current.finalBajoCarga).toBeNull();
  });

  it('un pesado no cambia: sin litros pide motivo aunque traiga cargas', () => {
    const { result } = cierre({ ...PESADO, cargas: CARGAS });
    expect(result.current.cargasPrevias).toBe(0);
    expect(result.current.soloKm).toBe(false);
    expect(result.current.motivoRequerido).toBe(true);
  });

  it('el km final bajo una carga (también la pendiente) se avisa y no deja cerrar', async () => {
    const { result } = cierre({ ...LIVIANO, cargas: CARGAS });
    act(() => result.current.setCierre((c) => ({ ...c, final: '45500' })));

    expect(result.current.finalBajoCarga).toMatch(/menor que el km de una carga.*45\.600 km/);
    await act(() => result.current.cerrar());
    expect(enqueueCloseCardMock).not.toHaveBeenCalled();

    act(() => result.current.setCierre((c) => ({ ...c, final: '45600' })));
    expect(result.current.finalBajoCarga).toBeNull();
    await act(() => result.current.cerrar());
    expect(enqueueCloseCardMock).toHaveBeenCalledTimes(1);
    expect(enqueueCloseCardMock.mock.calls[0]![2]).not.toHaveProperty('noFuelReason');
  });
});

describe('useCargaLiviano', () => {
  const render = (t: TarjetaTurno = LIVIANO) =>
    renderHook(() => useCargaLiviano({ tarjetas: [t, PESADO], equipos: EQUIPOS, ctx: CTX, userId: 'u1' }));

  it('al abrir NO prellena el km: el último conocido (última carga o camioneta) queda de referencia', () => {
    const conCargas = render({ ...LIVIANO, cargas: CARGAS });
    act(() => conCargas.result.current.abrirCarga('card-1'));
    expect(conCargas.result.current.form.km).toBe('');
    expect(conCargas.result.current.kmUltimo).toBe(45_600);

    const sinCargas = render();
    act(() => sinCargas.result.current.abrirCarga('card-1'));
    expect(sinCargas.result.current.form.km).toBe('');
    expect(sinCargas.result.current.kmUltimo).toBe(45_150);
  });

  it('una carga rechazada no cuenta como último km conocido', () => {
    const rechazada = { ...CARGAS[1]!, km: 99_000, requiereAtencion: true };
    const { result } = render({ ...LIVIANO, cargas: [CARGAS[0]!, rechazada] });
    act(() => result.current.abrirCarga('card-1'));
    expect(result.current.kmUltimo).toBe(45_300);
  });

  it('un salto grande sobre el último km se avisa sin bloquear', () => {
    photo.file = new File([new Uint8Array([1])], 'surtidor.jpg', { type: 'image/jpeg' });
    const { result } = render({ ...LIVIANO, cargas: CARGAS });
    act(() => result.current.abrirCarga('card-1'));
    act(() => result.current.setForm((f) => ({ ...f, litros: '40', km: '456000' })));

    expect(result.current.kmAviso).toBe('Es mucho más que el último registrado (45.600 km). Revisa que esté bien.');
    expect(result.current.kmError).toBeNull();
    expect(result.current.puedeGuardar).toBe(true);

    act(() => result.current.setForm((f) => ({ ...f, km: '46500' })));
    expect(result.current.kmAviso).toBeNull();
  });

  it('no abre la carga de un pesado', () => {
    const { result } = render();
    act(() => result.current.abrirCarga('card-2'));
    expect(result.current.cargando).toBeNull();
  });

  it('valida km bajo el inicial, litros y foto antes de dejar guardar', async () => {
    const { result } = render();
    act(() => result.current.abrirCarga('card-1'));
    act(() => result.current.setForm((f) => ({ ...f, km: '44000', litros: '0' })));

    expect(result.current.kmError).toMatch(/menor que el kilometraje inicial de la tarjeta \(45\.000 km\)/);
    expect(result.current.litrosError).toMatch(/más que 0/);
    expect(result.current.falta).toBe('Falta la foto del surtidor.');
    expect(result.current.puedeGuardar).toBe(false);
    await act(() => result.current.guardar());
    expect(submitWriteMock).not.toHaveBeenCalled();
  });

  it('una camioneta no carga cientos de litros', () => {
    const { result } = render();
    act(() => result.current.abrirCarga('card-1'));
    act(() => result.current.setForm((f) => ({ ...f, litros: '48493' })));
    expect(result.current.litrosError).toMatch(/no cabe en una camioneta/);
  });

  it('con todo listo, encola la carga con la foto, el turno en contexto y el AdBlue', async () => {
    photo.file = new File([new Uint8Array([1])], 'surtidor.jpg', { type: 'image/jpeg' });
    photo.captureDate = new Date('2026-11-18T14:58:00.000Z');
    submitWriteMock.mockResolvedValueOnce({ status: 'queued', opId: 'op-1' });
    const { result } = render();
    act(() => result.current.abrirCarga('card-1'));
    act(() =>
      result.current.setForm((f) => ({ ...f, litros: '48,493', km: '45320', adBlue: true, adBlueLitros: '5' })),
    );

    expect(result.current.puedeGuardar).toBe(true);
    await act(() => result.current.guardar());

    expect(submitWriteMock).toHaveBeenCalledTimes(1);
    const [endpoint, input, options] = submitWriteMock.mock.calls[0]!;
    expect(endpoint).toBe('shiftCard.fuelLoad');
    expect(options).toEqual({ waitMs: 0, userId: 'u1' });
    expect(input.params).toEqual({ id: 'card-1' });
    expect(input.body).toMatchObject({
      liters: 48.493,
      reading: 45_320,
      adBlueLiters: 5,
      photoCapturedAt: '2026-11-18T14:58:00.000Z',
      shiftDate: '2026-11-18',
      shiftType: CTX.turno,
    });
    expect(input.body.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(input.files).toEqual([{ field: 'tmpPhotoKey', file: photo.file }]);
    expect(result.current.cargando).toBeNull();
  });

  it('sin AdBlue no manda adBlueLiters', async () => {
    photo.file = new File([new Uint8Array([1])], 'surtidor.jpg', { type: 'image/jpeg' });
    submitWriteMock.mockResolvedValueOnce({ status: 'queued', opId: 'op-1' });
    const { result } = render();
    act(() => result.current.abrirCarga('card-1'));
    act(() => result.current.setForm((f) => ({ ...f, litros: '40', km: '45320' })));
    await act(() => result.current.guardar());

    expect(submitWriteMock.mock.calls[0]![1].body).not.toHaveProperty('adBlueLiters');
  });

  it('si no se pudo guardar en el equipo, avisa y deja el formulario abierto', async () => {
    photo.file = new File([new Uint8Array([1])], 'surtidor.jpg', { type: 'image/jpeg' });
    submitWriteMock.mockRejectedValueOnce(new Error('No hay espacio en el equipo para guardar esto.'));
    const { result } = render();
    act(() => result.current.abrirCarga('card-1'));
    act(() => result.current.setForm((f) => ({ ...f, litros: '40', km: '45320' })));
    await act(() => result.current.guardar());

    expect(toastDangerMock).toHaveBeenCalledWith('No hay espacio en el equipo para guardar esto.');
    expect(result.current.cargando).not.toBeNull();
  });
});
