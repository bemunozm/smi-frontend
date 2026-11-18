import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { waitFor } from '@testing-library/react';

const { sendWriteMock, uploadFileMock, openCardMock, closeCardMock } = vi.hoisted(() => ({
  openCardMock: vi.fn(),
  closeCardMock: vi.fn(),
  sendWriteMock: vi.fn(),
  uploadFileMock: vi.fn(),
}));

vi.mock('../api/ShiftCardAPI', () => ({
  ShiftCardAPI: { openCard: openCardMock, closeCard: closeCardMock, listMine: vi.fn() },
}));
vi.mock('../api/WriteAPI', () => ({ sendWrite: sendWriteMock }));
vi.mock('../api/UploadsAPI', () => ({ uploadFile: uploadFileMock }));
// jsdom no tiene canvas: la foto se guarda tal cual.
vi.mock('./photo', () => ({
  compressPhoto: async (file: File) => ({ data: await file.arrayBuffer(), mime: file.type, name: file.name }),
}));

import { db, type HttpWriteOp } from './db';
import { discardOp, enqueueCloseCard, enqueueOpenCard, patchCloseCardOp } from './outbox';
import { requestSync, resetReplayEngineForTests, setCurrentUser, useEngineStoreForTests } from './replay';
import { submitWrite } from './submit-write';
import { DomainError } from '../lib/api-error';
import { queryClient } from '../lib/query-client';
import { SHIFT_CARDS_MINE_KEY } from '../lib/query-keys';
import type { ShiftCardResponse } from '../types/shift';

function camioneta(overrides: Partial<ShiftCardResponse> = {}): ShiftCardResponse {
  return {
    id: 'card-1',
    equipoId: 'eq-1',
    equipo: { internalCode: 'CN-007', type: 'Camioneta', controlUnit: 'KM', equipmentClass: 'LIGHT' },
    operatorId: null,
    operatorName: '',
    supervisorId: 'u1',
    supervisorName: 'Ana Soto',
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
    fuelLoads: [],
    ...overrides,
  };
}

const foto = () => new File([new Uint8Array([1, 2, 3])], 'surtidor.jpg', { type: 'image/jpeg' });

const cuerpo = {
  id: 'carga-1',
  liters: 70,
  reading: 45_300,
  capturedAt: '2026-11-18T12:00:00.000Z',
  shiftDate: '2026-11-18',
  shiftType: 'DIURNO' as const,
};

function cargar(cardId = 'card-1') {
  return submitWrite(
    'shiftCard.fuelLoad',
    { params: { id: cardId }, body: cuerpo, files: [{ field: 'tmpPhotoKey', file: foto() }] },
    { waitMs: 0, userId: 'u1' },
  );
}

async function opDeCarga(): Promise<HttpWriteOp | undefined> {
  const ops = await db.outbox.toArray();
  return ops.find((op): op is HttpWriteOp => op.type === 'httpWrite' && op.endpoint === 'shiftCard.fuelLoad');
}

async function syncAndSettle(userId = 'u1') {
  useEngineStoreForTests.setState({ lastSyncAt: null });
  setCurrentUser(userId);
  requestSync();
  await waitFor(() => expect(useEngineStoreForTests.getState().lastSyncAt).not.toBeNull(), { timeout: 3000 });
}

beforeEach(async () => {
  await db.outbox.clear();
  await db.blobs.clear();
  queryClient.clear();
  resetReplayEngineForTests();
});

afterEach(() => {
  vi.clearAllMocks();
  vi.restoreAllMocks();
  resetReplayEngineForTests();
});

describe('carga de combustible sin cerrar (shiftCard.fuelLoad)', () => {
  it('se encola con la foto, sobre la entidad de la tarjeta y detrás de su apertura pendiente', async () => {
    await enqueueOpenCard('u1', {
      id: 'card-1',
      equipoId: 'eq-1',
      valorInicial: 45_000,
      shiftDate: '2026-11-18',
      shiftType: 'DIURNO',
      capturedAt: '2026-11-18T09:00:00.000Z',
    });
    const resultado = await cargar();

    expect(resultado.status).toBe('queued');
    const op = await opDeCarga();
    expect(op).toMatchObject({
      status: 'pending_upload',
      entityKey: 'shift-card:card-1',
      dependsOn: ['card-1'],
      params: { id: 'card-1' },
      body: cuerpo,
    });
    expect(op?.label).toMatch(/^Carga de combustible/);
    expect(op?.files).toHaveLength(1);
    expect(await db.blobs.get(op!.files![0]!.blobId)).toBeTruthy();
  });

  it('descartar la apertura arrastra la carga y su foto', async () => {
    await enqueueOpenCard('u1', {
      id: 'card-1',
      equipoId: 'eq-1',
      valorInicial: 45_000,
      shiftDate: '2026-11-18',
      shiftType: 'DIURNO',
      capturedAt: '2026-11-18T09:00:00.000Z',
    });
    await cargar();
    const blobId = (await opDeCarga())!.files![0]!.blobId;

    await discardOp('card-1', 'u1');

    expect(await db.outbox.count()).toBe(0);
    expect(await db.blobs.get(blobId)).toBeUndefined();
  });

  it('el replay sube la foto, manda la key en tmpPhotoKey y deja la tarjeta (con la carga) en el caché', async () => {
    queryClient.setQueryData(SHIFT_CARDS_MINE_KEY, [camioneta()]);
    uploadFileMock.mockResolvedValueOnce({ key: 'tmp/u1/surtidor.jpg', url: 'u' });
    const conCarga = camioneta({
      fuelLoads: [
        {
          id: 'carga-1',
          liters: 70,
          reading: 45_300,
          adBlueLiters: null,
          pumpPhotoUrl: 'https://firmada',
          fecha: '2026-11-18',
          createdAt: '2026-11-18T12:00:01.000Z',
          createdByName: 'Ana Soto',
        },
      ],
    });
    sendWriteMock.mockResolvedValueOnce(conCarga);
    await cargar();

    await syncAndSettle();

    expect(sendWriteMock).toHaveBeenCalledTimes(1);
    expect(sendWriteMock.mock.calls[0]![0]).toMatchObject({
      method: 'POST',
      url: '/api/shift-cards/card-1/fuel-loads',
      body: { ...cuerpo, tmpPhotoKey: 'tmp/u1/surtidor.jpg' },
    });
    expect(await opDeCarga()).toBeUndefined();
    expect(await db.blobs.count()).toBe(0);
    const cache = queryClient.getQueryData<ShiftCardResponse[]>(SHIFT_CARDS_MINE_KEY);
    expect(cache?.[0]?.fuelLoads).toHaveLength(1);
  });

  it('ALREADY_CLOSED: queda en atención con el mensaje, sin reintentar en bucle ni perder la foto', async () => {
    uploadFileMock.mockResolvedValueOnce({ key: 'tmp/u1/surtidor.jpg', url: 'u' });
    sendWriteMock.mockRejectedValue(
      new DomainError('La tarjeta ya está cerrada', { code: 'ALREADY_CLOSED', status: 409 }),
    );
    await cargar();

    await syncAndSettle();
    await syncAndSettle();

    expect(sendWriteMock).toHaveBeenCalledTimes(1);
    const op = await opDeCarga();
    expect(op?.status).toBe('needs_attention');
    expect(op?.lastError?.message).toMatch(/ya cerró esta tarjeta/);
    expect(await db.blobs.count()).toBe(1);
  });

  it('TMP_KEY_EXPIRED: resube la foto una vez y envía', async () => {
    uploadFileMock
      .mockResolvedValueOnce({ key: 'tmp/u1/vieja.jpg', url: 'u' })
      .mockResolvedValueOnce({ key: 'tmp/u1/nueva.jpg', url: 'u' });
    sendWriteMock
      .mockRejectedValueOnce(new DomainError('expiró', { code: 'TMP_KEY_EXPIRED', status: 400 }))
      .mockResolvedValueOnce(camioneta());
    await cargar();

    await syncAndSettle();

    expect(uploadFileMock).toHaveBeenCalledTimes(2);
    expect(sendWriteMock.mock.calls[1]![0].body).toMatchObject({ tmpPhotoKey: 'tmp/u1/nueva.jpg' });
    expect(await opDeCarga()).toBeUndefined();
  });

  it('un cierre encolado después viaja detrás de la carga', async () => {
    uploadFileMock.mockResolvedValue({ key: 'tmp/u1/surtidor.jpg', url: 'u' });
    sendWriteMock.mockResolvedValueOnce(camioneta());
    closeCardMock.mockResolvedValueOnce(camioneta({ valorFinal: 45_400, closedAt: '2026-11-18T18:00:00.000Z' }));
    await cargar();
    await enqueueCloseCard(
      'u1',
      'card-1',
      { closeClientId: 'close-1', valorFinal: 45_400, fuelLiters: 0, capturedAt: '2026-11-18T18:00:00.000Z' },
      null,
    );

    await syncAndSettle();

    expect(sendWriteMock.mock.invocationCallOrder[0]!).toBeLessThan(closeCardMock.mock.invocationCallOrder[0]!);
    expect(await db.outbox.count()).toBe(0);
  });
});

describe('cierre de liviano rechazado por una carga con km mayor (READING_BELOW_FUEL_LOAD)', () => {
  const rechazo = () =>
    new DomainError(
      'La lectura final (45.200) no puede ser menor que la de una carga de combustible registrada en la tarjeta (45.300)',
      { code: 'READING_BELOW_FUEL_LOAD', status: 400 },
    );

  it('queda en atención con el mensaje del servidor más qué hacer, y no reintenta solo', async () => {
    closeCardMock.mockRejectedValue(rechazo());
    await enqueueCloseCard(
      'u1',
      'card-1',
      { closeClientId: 'close-1', valorFinal: 45_200, fuelLiters: 0, capturedAt: '2026-11-18T18:00:00.000Z' },
      null,
    );

    await syncAndSettle();
    await syncAndSettle();

    expect(closeCardMock).toHaveBeenCalledTimes(1);
    const op = await db.outbox.get('close-1');
    expect(op?.status).toBe('needs_attention');
    expect(op?.lastError?.message).toContain('(45.300)');
    expect(op?.lastError?.message).toContain('Corrige el km final');
  });

  it('corregir el km final la vuelve a poner en cola y se envía con el valor nuevo', async () => {
    closeCardMock
      .mockRejectedValueOnce(rechazo())
      .mockResolvedValueOnce(camioneta({ closedAt: '2026-11-18T18:00:00.000Z' }));
    await enqueueCloseCard(
      'u1',
      'card-1',
      { closeClientId: 'close-1', valorFinal: 45_200, fuelLiters: 0, capturedAt: '2026-11-18T18:00:00.000Z' },
      null,
    );
    await syncAndSettle();

    expect(await patchCloseCardOp('close-1', 'u1', { valorFinal: 45_350 })).toBe('updated');
    await syncAndSettle();

    expect(closeCardMock).toHaveBeenCalledTimes(2);
    expect(closeCardMock.mock.calls[1]![1]).toMatchObject({ valorFinal: 45_350 });
    expect(await db.outbox.get('close-1')).toBeUndefined();
  });
});
