import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { waitFor } from '@testing-library/react';

const { sendWriteMock, uploadFileMock, openCardMock } = vi.hoisted(() => ({
  openCardMock: vi.fn(),
  sendWriteMock: vi.fn(),
  uploadFileMock: vi.fn(),
}));

vi.mock('../api/ShiftCardAPI', () => ({
  ShiftCardAPI: { openCard: openCardMock, closeCard: vi.fn(), listMine: vi.fn() },
}));
vi.mock('../api/WriteAPI', () => ({ sendWrite: sendWriteMock }));
vi.mock('../api/UploadsAPI', () => ({ uploadFile: uploadFileMock }));

import { db, type HttpWriteOp, type OutboxOp } from './db';
import { ENDPOINTS } from './endpoints';
import {
  discardOp,
  enqueueCreateTrabajoExtra,
  enqueueExitReport,
  enqueueHttpWrite,
  enqueueOpenCard,
  overwriteOp,
  patchCloseCardOp,
  patchOpenCardOp,
  retryOp,
} from './outbox';
import { requestSync, resetReplayEngineForTests, setCurrentUser, useEngineStoreForTests } from './replay';
import { submitWrite } from './submit-write';
import { DomainError } from '../lib/api-error';
import { queryClient } from '../lib/query-client';
import { SHIFT_CARDS_MINE_KEY } from '../lib/query-keys';
import type { ShiftCardResponse } from '../types/shift';

function card(overrides: Partial<ShiftCardResponse> = {}): ShiftCardResponse {
  return {
    id: 'card-1',
    equipoId: 'eq-1',
    equipo: { internalCode: 'EX-005', type: 'Excavadora', controlUnit: 'HOURS' },
    operatorId: 'op-1',
    operatorName: 'Patricio Rojas',
    supervisorId: 'u1',
    supervisorName: 'Ana Soto',
    shift: { id: 'sh-1', date: '2026-09-24', type: 'DIURNO', exitReports: [] },
    valorInicial: 100,
    valorFinal: 130,
    horasMaquina: 30,
    fuelLiters: 20,
    adBlue: false,
    adBlueLiters: null,
    pumpPhotoUrl: null,
    observaciones: null,
    belowPreviousReading: false,
    fecha: '2026-09-24T09:00:00.000Z',
    fechaSalida: null,
    createdAt: '2026-09-24T09:00:00.000Z',
    closedAt: '2026-09-24T16:00:00.000Z',
    ...overrides,
  };
}

let nextSeq = 1;

function putHttpOp(overrides: Partial<HttpWriteOp> = {}): Promise<string> {
  const seq = overrides.seq ?? nextSeq++;
  const op: HttpWriteOp = {
    id: `w-${seq}`,
    type: 'httpWrite',
    v: 1,
    userId: 'u1',
    endpoint: 'shiftCard.edit',
    params: { id: 'card-1' },
    body: { valorFinal: 140 },
    expected: { valorFinal: 130 },
    label: 'Edición de tarjeta · EX-005',
    status: 'pending',
    attempts: 0,
    seq,
    createdAt: seq,
    updatedAt: seq,
    ...overrides,
  };
  return db.outbox.put(op);
}

async function syncAndSettle(userId = 'u1') {
  setCurrentUser(userId);
  requestSync();
  await waitFor(() => expect(useEngineStoreForTests.getState().lastSyncAt).not.toBeNull(), { timeout: 3000 });
}

async function put(id: string): Promise<OutboxOp | undefined> {
  return db.outbox.get(id);
}

beforeEach(async () => {
  nextSeq = 1;
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

describe('replay de httpWrite', () => {
  it('manda el método y la URL del registro, con X-Expected y X-Client-Time, y borra la operación', async () => {
    sendWriteMock.mockResolvedValueOnce(card({ valorFinal: 140 }));
    await putHttpOp({ id: 'w-1' });

    await syncAndSettle();

    expect(sendWriteMock).toHaveBeenCalledTimes(1);
    const request = sendWriteMock.mock.calls[0]![0];
    expect(request).toMatchObject({ method: 'PATCH', url: '/api/shift-cards/card-1', body: { valorFinal: 140 } });
    expect(JSON.parse(decodeURIComponent(request.headers['X-Expected']))).toEqual({ valorFinal: 130 });
    expect(request.headers['X-Client-Time']).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(await put('w-1')).toBeUndefined();
  });

  it('X-Expected viaja codificado: los valores base con texto no Latin-1 no rompen el header', async () => {
    sendWriteMock.mockResolvedValueOnce(card());
    const base = 'Falla — “hidráulico” 🚜 revisar';
    await putHttpOp({ id: 'w-1', body: { observaciones: 'ok' }, expected: { observaciones: base, adBlueLiters: null } });

    await syncAndSettle();

    const header: string = sendWriteMock.mock.calls[0]![0].headers['X-Expected'];
    // Solo ASCII: un header HTTP con otra cosa hace que el navegador lance.
    expect(/^[\x20-\x7e]*$/.test(header)).toBe(true);
    expect(JSON.parse(decodeURIComponent(header))).toEqual({ observaciones: base, adBlueLiters: null });
  });

  it('sin `expected` no manda X-Expected', async () => {
    sendWriteMock.mockResolvedValueOnce(card());
    await putHttpOp({ id: 'w-1', expected: undefined });

    await syncAndSettle();

    expect(sendWriteMock.mock.calls[0]![0].headers).not.toHaveProperty('X-Expected');
  });

  it('escribe la respuesta en el caché antes de borrar la operación y la invalida por nombre', async () => {
    queryClient.setQueryData(SHIFT_CARDS_MINE_KEY, [card({ valorFinal: 130 })]);
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries');
    sendWriteMock.mockResolvedValueOnce(card({ valorFinal: 140 }));
    await putHttpOp({ id: 'w-1', invalidate: ['horometro'] });

    await syncAndSettle();

    expect(queryClient.getQueryData<ShiftCardResponse[]>(SHIFT_CARDS_MINE_KEY)?.[0]?.valorFinal).toBe(140);
    const keys = invalidate.mock.calls.map((c) => JSON.stringify(c[0]?.queryKey));
    // Las del registro (`shiftCards`, `equipment`) y la extra que pidió la operación.
    expect(keys).toEqual(expect.arrayContaining([
      JSON.stringify(['shift-cards']),
      JSON.stringify(['equipment']),
      JSON.stringify(['horometro']),
    ]));
  });

  it('un cuerpo de respuesta que no calza no traba la operación: se borra igual', async () => {
    sendWriteMock.mockResolvedValueOnce({ cualquier: 'cosa' });
    await putHttpOp({ id: 'w-1' });

    await syncAndSettle();

    expect(await put('w-1')).toBeUndefined();
  });

  describe('archivos', () => {
    async function putFileOp(overrides: Partial<HttpWriteOp> = {}) {
      await db.blobs.put({ id: 'b-1', data: new Uint8Array([1, 2, 3]).buffer, mime: 'application/pdf', name: 'doc.pdf', createdAt: 1 });
      await putHttpOp({
        id: 'w-1',
        status: 'pending_upload',
        body: { nombre: 'x' },
        files: [{ field: 'fileKey', blobId: 'b-1' }],
        ...overrides,
      });
    }

    it('sube primero el archivo, manda su key en el campo y borra el blob', async () => {
      uploadFileMock.mockResolvedValueOnce({ key: 'tmp/u1/doc.pdf', url: 'u' });
      sendWriteMock.mockResolvedValueOnce(card());
      await putFileOp();

      await syncAndSettle();

      expect(uploadFileMock).toHaveBeenCalledTimes(1);
      const file: File = uploadFileMock.mock.calls[0]![0];
      expect(file.name).toBe('doc.pdf');
      expect(sendWriteMock.mock.calls[0]![0].body).toEqual({ nombre: 'x', fileKey: 'tmp/u1/doc.pdf' });
      expect(await put('w-1')).toBeUndefined();
      expect(await db.blobs.get('b-1')).toBeUndefined();
    });

    it('si el envío falla por red, la key ya subida se conserva y no se vuelve a subir', async () => {
      uploadFileMock.mockResolvedValueOnce({ key: 'tmp/u1/doc.pdf', url: 'u' });
      sendWriteMock.mockRejectedValueOnce(new DomainError('Sin señal'));
      await putFileOp();
      await syncAndSettle();

      expect(await put('w-1')).toMatchObject({
        status: 'pending_claim',
        files: [{ field: 'fileKey', blobId: 'b-1', tmpKey: 'tmp/u1/doc.pdf' }],
      });

      sendWriteMock.mockResolvedValueOnce(card());
      useEngineStoreForTests.setState({ lastSyncAt: null });
      await syncAndSettle();

      expect(uploadFileMock).toHaveBeenCalledTimes(1);
      expect(await put('w-1')).toBeUndefined();
    });

    it('TMP_KEY_EXPIRED limpia las keys y resube UNA vez', async () => {
      uploadFileMock
        .mockResolvedValueOnce({ key: 'tmp/u1/vieja.pdf', url: 'u' })
        .mockResolvedValueOnce({ key: 'tmp/u1/nueva.pdf', url: 'u' });
      sendWriteMock
        .mockRejectedValueOnce(new DomainError('expiró', { code: 'TMP_KEY_EXPIRED', status: 400 }))
        .mockResolvedValueOnce(card());
      await putFileOp();

      await syncAndSettle();

      expect(uploadFileMock).toHaveBeenCalledTimes(2);
      expect(sendWriteMock.mock.calls[1]![0].body).toEqual({ nombre: 'x', fileKey: 'tmp/u1/nueva.pdf' });
      expect(await put('w-1')).toBeUndefined();
    });

    it('un segundo TMP_KEY_EXPIRED ya no reintenta: pasa a atención', async () => {
      uploadFileMock.mockResolvedValue({ key: 'tmp/u1/k.pdf', url: 'u' });
      sendWriteMock.mockRejectedValue(new DomainError('expiró', { code: 'TMP_KEY_EXPIRED', status: 400 }));
      await putFileOp();

      await syncAndSettle();

      expect(uploadFileMock).toHaveBeenCalledTimes(2);
      expect((await put('w-1'))?.status).toBe('needs_attention');
    });

    it('si falta el blob guardado, es un error de negocio (no se reintenta solo)', async () => {
      await putHttpOp({ id: 'w-1', status: 'pending_upload', files: [{ field: 'fileKey', blobId: 'no-existe' }] });

      await syncAndSettle();

      expect(await put('w-1')).toMatchObject({ status: 'needs_attention', lastError: { code: 'PHOTO_MISSING' } });
    });
  });

  describe('404 como hecho', () => {
    afterEach(() => {
      ENDPOINTS['hallazgo.edit'].notFoundIsDone = false;
    });

    it('con la bandera, un 404 al reintentar cuenta como hecho (un DELETE que ya estaba borrado)', async () => {
      ENDPOINTS['hallazgo.edit'].notFoundIsDone = true;
      sendWriteMock.mockRejectedValueOnce(new DomainError('no existe', { status: 404 }));
      await putHttpOp({ id: 'w-1', endpoint: 'hallazgo.edit', params: { id: 'h-1' }, body: { estado: 'CERRADO' } });

      await syncAndSettle();

      expect(await put('w-1')).toBeUndefined();
    });

    it('sin la bandera, el mismo 404 es un error de negocio', async () => {
      sendWriteMock.mockRejectedValueOnce(new DomainError('no existe', { status: 404 }));
      await putHttpOp({ id: 'w-1', endpoint: 'hallazgo.edit', params: { id: 'h-1' }, body: { estado: 'CERRADO' } });

      await syncAndSettle();

      expect((await put('w-1'))?.status).toBe('needs_attention');
    });
  });
});

describe('STALE_UPDATE', () => {
  it('pasa a atención con el mensaje de conflicto y no bloquea a otras entidades', async () => {
    sendWriteMock
      .mockRejectedValueOnce(new DomainError('stale', { code: 'STALE_UPDATE', status: 409 }))
      .mockResolvedValueOnce(card());
    await putHttpOp({ id: 'w-1', entityKey: 'shift-card:card-1' });
    await putHttpOp({ id: 'w-2', params: { id: 'card-2' }, entityKey: 'shift-card:card-2' });

    await syncAndSettle();

    expect(await put('w-1')).toMatchObject({
      status: 'needs_attention',
      lastError: { code: 'STALE_UPDATE', status: 409, message: expect.stringContaining('Sobrescribir') },
    });
    expect(await put('w-2')).toBeUndefined();
  });

  it('una edición posterior de la MISMA entidad espera mientras la anterior está en atención', async () => {
    sendWriteMock.mockRejectedValueOnce(new DomainError('stale', { code: 'STALE_UPDATE', status: 409 }));
    await putHttpOp({ id: 'w-1', entityKey: 'shift-card:card-1' });
    await putHttpOp({ id: 'w-2', entityKey: 'shift-card:card-1', body: { fuelLiters: 5 }, expected: { fuelLiters: 4 } });

    await syncAndSettle();

    expect(sendWriteMock).toHaveBeenCalledTimes(1);
    expect((await put('w-2'))?.status).toBe('pending');
  });

  it('"Sobrescribir" reenvía la misma operación SIN precondición', async () => {
    sendWriteMock
      .mockRejectedValueOnce(new DomainError('stale', { code: 'STALE_UPDATE', status: 409 }))
      .mockResolvedValueOnce(card());
    await putHttpOp({ id: 'w-1' });
    await syncAndSettle();
    expect((await put('w-1'))?.status).toBe('needs_attention');

    await overwriteOp('w-1', 'u1');
    useEngineStoreForTests.setState({ lastSyncAt: null });
    await syncAndSettle();

    expect(sendWriteMock).toHaveBeenCalledTimes(2);
    expect(sendWriteMock.mock.calls[1]![0].headers).not.toHaveProperty('X-Expected');
    expect(sendWriteMock.mock.calls[1]![0].body).toEqual({ valorFinal: 140 });
    expect(await put('w-1')).toBeUndefined();
  });

  it('overwriteOp ignora operaciones de otro usuario', async () => {
    await putHttpOp({ id: 'w-1', status: 'needs_attention' });

    await overwriteOp('w-1', 'otro');

    expect((await put('w-1') as HttpWriteOp).expected).toEqual({ valorFinal: 130 });
  });
});

describe('tope de intentos por 5xx', () => {
  it('a los 5 errores de servidor seguidos pasa a atención', async () => {
    sendWriteMock.mockRejectedValue(new DomainError('boom', { status: 503 }));
    await putHttpOp({ id: 'w-1' });

    for (let intento = 1; intento <= 4; intento += 1) {
      useEngineStoreForTests.setState({ lastSyncAt: null });
      await syncAndSettle();
      expect(await put('w-1')).toMatchObject({ status: 'pending', serverErrors: intento });
    }
    useEngineStoreForTests.setState({ lastSyncAt: null });
    await syncAndSettle();

    expect(await put('w-1')).toMatchObject({
      status: 'needs_attention',
      lastError: { status: 503, message: expect.stringContaining('varias veces') },
    });
    expect(sendWriteMock).toHaveBeenCalledTimes(5);
  });

  it('los errores de red (sin status) no tienen tope', async () => {
    sendWriteMock.mockRejectedValue(new DomainError('Sin señal'));
    await putHttpOp({ id: 'w-1' });

    for (let intento = 1; intento <= 8; intento += 1) {
      useEngineStoreForTests.setState({ lastSyncAt: null });
      await syncAndSettle();
    }

    expect(await put('w-1')).toMatchObject({ status: 'pending', attempts: 8 });
  });

  it('"Reintentar" una operación en atención por 5xx reinicia el contador', async () => {
    await putHttpOp({ id: 'w-1', status: 'needs_attention', serverErrors: 5 });

    await retryOp('w-1', 'u1');
    await waitFor(() => expect(sendWriteMock).toHaveBeenCalled(), { timeout: 100 }).catch(() => undefined);

    expect((await put('w-1'))?.serverErrors).toBe(0);
  });
});

describe('dependsOn y descarte en cascada', () => {
  it('una operación no se manda mientras aquella de la que depende espera atención (transitivo)', async () => {
    await putHttpOp({ id: 'a', status: 'needs_attention' });
    await putHttpOp({ id: 'b', dependsOn: ['a'], params: { id: 'card-2' } });
    await putHttpOp({ id: 'c', dependsOn: ['b'], params: { id: 'card-3' } });

    await syncAndSettle();

    expect(sendWriteMock).not.toHaveBeenCalled();
    expect((await put('b'))?.status).toBe('pending');
    expect((await put('c'))?.status).toBe('pending');
  });

  it('descartar arrastra a los dependientes (transitivo) y a sus archivos, y deja lo demás', async () => {
    await db.blobs.bulkPut([
      { id: 'b-1', data: new ArrayBuffer(1), mime: 'application/pdf', name: 'x.pdf', createdAt: 1 },
      { id: 'b-2', data: new ArrayBuffer(1), mime: 'application/pdf', name: 'y.pdf', createdAt: 1 },
    ]);
    await putHttpOp({ id: 'a', status: 'needs_attention' });
    await putHttpOp({ id: 'b', dependsOn: ['a'], files: [{ field: 'f', blobId: 'b-1' }] });
    await putHttpOp({ id: 'c', dependsOn: ['b'] });
    await putHttpOp({ id: 'libre', files: [{ field: 'f', blobId: 'b-2' }] });

    await discardOp('a', 'u1');

    expect((await db.outbox.toArray()).map((o) => o.id)).toEqual(['libre']);
    expect((await db.blobs.toArray()).map((b) => b.id)).toEqual(['b-2']);
  });
});

describe('orden FIFO por seq', () => {
  it('encolar en el mismo milisegundo, o con el reloj hacia atrás, igual da seq estrictamente creciente', async () => {
    const reloj = vi.spyOn(Date, 'now');
    reloj.mockReturnValue(5_000);
    await enqueueOpenCard('u1', { id: 'a', equipoId: 'e', operatorId: 'o', valorInicial: 1, shiftDate: '2026-09-24', shiftType: 'DIURNO', capturedAt: 't' });
    await enqueueExitReport('u1', { id: 'b', shiftDate: '2026-09-24', shiftType: 'DIURNO', cardIds: ['a'], requestedAt: 't' });
    reloj.mockReturnValue(1_000); // el reloj retrocede
    await enqueueCreateTrabajoExtra('u1', {
      id: 'c', equipoId: 'e', operatorId: 'o', faena: 'Patillo', turno: 'DIURNO', horometroInicial: 1, horometroFinal: 2,
      actividades: ['OTRO'], otraActividad: 'x', descripcion: 'abc', capturedAt: 't',
    });
    reloj.mockRestore();

    const ops = await db.outbox.orderBy('seq').toArray();

    expect(ops.map((o) => o.id)).toEqual(['a', 'b', 'c']);
    expect(ops[0]!.seq).toBe(5_000);
    expect(ops[1]!.seq).toBe(5_001);
    expect(ops[2]!.seq).toBe(5_002);
  });

  it('el replay procesa por seq aunque createdAt diga otra cosa', async () => {
    sendWriteMock.mockResolvedValue(card());
    await putHttpOp({ id: 'segundo', seq: 20, createdAt: 1, params: { id: 'card-2' } });
    await putHttpOp({ id: 'primero', seq: 10, createdAt: 999, params: { id: 'card-1' } });

    await syncAndSettle();

    expect(sendWriteMock.mock.calls.map((c) => c[0].url)).toEqual([
      '/api/shift-cards/card-1',
      '/api/shift-cards/card-2',
    ]);
  });
});

describe('enqueueHttpWrite', () => {
  it('guarda params/body/expected/label con un seq y deja la operación pendiente', async () => {
    const op = await enqueueHttpWrite('u1', {
      id: 'w-1',
      endpoint: 'hallazgo.edit',
      params: { id: 'h-1' },
      body: { estado: 'CERRADO' },
      expected: { estado: 'ABIERTO' },
      entityKey: 'hallazgo:h-1',
      label: 'Edición de hallazgo',
    });

    expect(await db.outbox.get('w-1')).toMatchObject({
      type: 'httpWrite',
      endpoint: 'hallazgo.edit',
      status: 'pending',
      entityKey: 'hallazgo:h-1',
      expected: { estado: 'ABIERTO' },
    });
    expect(op.seq).toBeGreaterThan(0);
  });

  it('rechaza archivos en un endpoint que no los lleva, y archivos de más de 8 MB', async () => {
    const spec = { id: 'w-1', endpoint: 'hallazgo.edit' as const, params: { id: 'h' }, body: {}, label: 'x' };
    const chico = new File([new Uint8Array([1])], 'a.pdf', { type: 'application/pdf' });

    await expect(enqueueHttpWrite('u1', { ...spec, files: [{ field: 'f', file: chico }] })).rejects.toMatchObject({
      code: 'ENDPOINT_NOT_QUEUEABLE',
    });
    const grande = new File([new Uint8Array(9 * 1024 * 1024)], 'b.pdf', { type: 'application/pdf' });
    await expect(enqueueHttpWrite('u1', { ...spec, files: [{ field: 'f', file: grande }] })).rejects.toMatchObject({
      code: 'ENDPOINT_NOT_QUEUEABLE',
    });
  });

  it('QuotaExceededError al encolar se traduce a un error claro y no deja nada a medias', async () => {
    const cuota = Object.assign(new Error('quota'), { name: 'QuotaExceededError' });
    vi.spyOn(db, 'transaction').mockRejectedValueOnce(cuota);

    await expect(
      enqueueOpenCard('u1', { id: 'a', equipoId: 'e', operatorId: 'o', valorInicial: 1, shiftDate: '2026-09-24', shiftType: 'DIURNO', capturedAt: 't' }),
    ).rejects.toMatchObject({ code: 'STORAGE_FULL', message: expect.stringContaining('espacio') });
    expect(await db.outbox.count()).toBe(0);
  });
});

describe('editar la operación encolada de una tarjeta', () => {
  const abrir = () =>
    enqueueOpenCard('u1', { id: 'card-9', equipoId: 'e', operatorId: 'op-1', valorInicial: 100, shiftDate: '2026-09-24', shiftType: 'DIURNO', capturedAt: 't' });

  it('patchOpenCardOp cambia operador y horómetro inicial de la apertura pendiente', async () => {
    await abrir();

    expect(await patchOpenCardOp('card-9', 'u1', { operatorId: 'op-2', valorInicial: 105 })).toBe('updated');

    expect((await db.outbox.get('card-9') as OutboxOp & { payload: { operatorId: string; valorInicial: number; equipoId: string } }).payload)
      .toMatchObject({ operatorId: 'op-2', valorInicial: 105, equipoId: 'e' });
  });

  it('una operación rechazada (needs_attention) vuelve a pendiente al editarla', async () => {
    await abrir();
    await db.outbox.update('card-9', { status: 'needs_attention', lastError: { message: 'x', code: 'OPERATOR_INACTIVE' } });

    await patchOpenCardOp('card-9', 'u1', { operatorId: 'op-3' });

    expect(await db.outbox.get('card-9')).toMatchObject({ status: 'pending', lastError: undefined });
  });

  it('en vuelo (syncing) no se toca: el llamador encola un PATCH aparte', async () => {
    await abrir();
    await db.outbox.update('card-9', { status: 'syncing' });

    expect(await patchOpenCardOp('card-9', 'u1', { valorInicial: 1 })).toBe('maybe-sent');
    expect((await db.outbox.get('card-9') as OutboxOp & { payload: { valorInicial: number } }).payload.valorInicial).toBe(100);
  });

  describe('una operación que pudo haber llegado al servidor (dispatched)', () => {
    const payloadAbierta = () => db.outbox.get('card-9').then((o) => (o?.type === 'openCard' ? o.payload : undefined));

    it('error transitorio tras el envío: la marca sobrevive y editar ya no toca el payload', async () => {
      await abrir();
      openCardMock.mockRejectedValueOnce(new DomainError('Sin señal'));
      await syncAndSettle();
      expect(await db.outbox.get('card-9')).toMatchObject({ status: 'pending', dispatched: true });

      expect(await patchOpenCardOp('card-9', 'u1', { valorInicial: 1 })).toBe('maybe-sent');
      expect((await payloadAbierta())?.valorInicial).toBe(100);
    });

    it('syncing que quedó colgado (app matada) y fue reseteado: también cuenta como enviada', async () => {
      await abrir();
      await db.outbox.update('card-9', { status: 'syncing', dispatched: true });
      // Retenida detrás de otra en atención: el replay solo la resetea, no la reenvía.
      await putHttpOp({ id: 'previa', seq: 0, status: 'needs_attention', entityKey: 'shift-card:card-9' });
      await db.outbox.update('card-9', { entityKey: 'shift-card:card-9' });
      await syncAndSettle();
      expect(await db.outbox.get('card-9')).toMatchObject({ status: 'pending', dispatched: true });

      expect(await patchOpenCardOp('card-9', 'u1', { valorInicial: 1 })).toBe('maybe-sent');
      expect(openCardMock).not.toHaveBeenCalled();
    });

    it('rechazada con un 4xx definitivo (409/400): se edita en el lugar y vuelve a pendiente', async () => {
      for (const status of [409, 400]) {
        await db.outbox.clear();
        await abrir();
        await db.outbox.update('card-9', { status: 'needs_attention', dispatched: true, lastError: { message: 'x', status } });

        expect(await patchOpenCardOp('card-9', 'u1', { valorInicial: 7 })).toBe('updated');

        expect(await db.outbox.get('card-9')).toMatchObject({
          status: 'pending',
          dispatched: true,
          payload: { valorInicial: 7 },
        });
      }
    });

    it.each([
      ['el tope de reintentos por 5xx', { message: 'x', status: 503 }],
      ['una respuesta inválida (sin status)', { message: 'x', code: 'INVALID_RESPONSE' }],
      ['un 429', { message: 'x', status: 429 }],
    ])('needs_attention por %s: pudo aplicarse, no se edita en el lugar', async (_nombre, lastError) => {
      await abrir();
      await db.outbox.update('card-9', { status: 'needs_attention', dispatched: true, lastError });

      expect(await patchOpenCardOp('card-9', 'u1', { valorInicial: 7 })).toBe('maybe-sent');
      expect((await payloadAbierta())?.valorInicial).toBe(100);
    });

    it('sin la marca (operación guardada por una versión vieja) cuenta como no enviada', async () => {
      await abrir();

      expect(await patchOpenCardOp('card-9', 'u1', { valorInicial: 7 })).toBe('updated');
    });
  });

  it('ya sincronizada (no existe) o de otro usuario: "missing"', async () => {
    expect(await patchOpenCardOp('no-existe', 'u1', { valorInicial: 1 })).toBe('missing');
    await abrir();
    expect(await patchOpenCardOp('card-9', 'otro', { valorInicial: 1 })).toBe('missing');
  });

  it('patchCloseCardOp cambia el cierre pendiente: litros, AdBlue y observaciones', async () => {
    await db.outbox.put({
      id: 'close-9', type: 'closeCard', v: 1, userId: 'u1', status: 'pending_upload', attempts: 0, photoId: 'close-9',
      seq: 1, createdAt: 1, updatedAt: 1, dependsOn: ['card-9'],
      payload: { cardId: 'card-9', input: { closeClientId: 'close-9', valorFinal: 130, fuelLiters: 20, capturedAt: 't' } },
    });

    expect(await patchCloseCardOp('close-9', 'u1', { fuelLiters: 25, adBlue: true, adBlueLiters: 12, observaciones: 'ok' })).toBe('updated');

    const op = await db.outbox.get('close-9');
    expect(op?.type === 'closeCard' && op.payload.input).toMatchObject({
      valorFinal: 130, fuelLiters: 25, adBlue: true, adBlueLiters: 12, observaciones: 'ok',
    });
    expect(op?.status).toBe('pending_upload');
  });
});

describe('submitWrite', () => {
  const edicion = { params: { id: 'card-1' }, body: { valorFinal: 140 }, expected: { valorFinal: 130 } };

  it('con espera y éxito: { status: "sent", data } con el resultado del servidor', async () => {
    sendWriteMock.mockResolvedValueOnce(card({ valorFinal: 140 }));
    setCurrentUser('u1');

    const resultado = await submitWrite('shiftCard.edit', edicion, { waitMs: 3000 });

    expect(resultado.status).toBe('sent');
    expect(resultado.status === 'sent' && resultado.data?.valorFinal).toBe(140);
    expect(await db.outbox.count()).toBe(0);
  });

  it('siempre encola primero: con waitMs 0 devuelve queued y la operación queda en el outbox', async () => {
    const resultado = await submitWrite('shiftCard.edit', edicion, { waitMs: 0, userId: 'u1' });

    expect(resultado).toEqual({ status: 'queued', opId: expect.any(String) });
    expect(await db.outbox.toArray()).toMatchObject([
      { type: 'httpWrite', endpoint: 'shiftCard.edit', label: 'Edición de tarjeta', expected: { valorFinal: 130 } },
    ]);
  });

  it('error de negocio mientras espera: lanza el DomainError y borra la operación y sus dependientes', async () => {
    // Mientras la request está en vuelo se encola algo que depende de ella.
    sendWriteMock.mockImplementationOnce(async () => {
      const [propia] = await db.outbox.toArray();
      await putHttpOp({ id: 'hija', seq: propia!.seq + 1000, dependsOn: [propia!.id], params: { id: 'card-2' } });
      throw new DomainError('no', { code: 'HOURMETER_BELOW_INITIAL', status: 400 });
    });
    setCurrentUser('u1');
    const promesa = submitWrite('shiftCard.edit', edicion, { waitMs: 3000 });

    await expect(promesa).rejects.toMatchObject({
      name: 'DomainError',
      code: 'HOURMETER_BELOW_INITIAL',
      message: 'El horómetro final no puede ser menor que el inicial.',
    });
    expect(await db.outbox.count()).toBe(0);
  });

  it('sin señal (error transitorio): queued enseguida, sin esperar todo el plazo; la operación sigue', async () => {
    sendWriteMock.mockRejectedValueOnce(new DomainError('Sin señal'));
    setCurrentUser('u1');
    const inicio = Date.now();

    const resultado = await submitWrite('shiftCard.edit', edicion, { waitMs: 5000 });

    expect(resultado).toEqual({ status: 'queued', opId: expect.any(String) });
    expect(Date.now() - inicio).toBeLessThan(2000);
    expect(await db.outbox.count()).toBe(1);
  });

  it('plazo agotado: queued', async () => {
    sendWriteMock.mockImplementationOnce(() => new Promise(() => undefined));
    setCurrentUser('u1');

    const resultado = await submitWrite('shiftCard.edit', edicion, { waitMs: 50 });

    expect(resultado).toEqual({ status: 'queued', opId: expect.any(String) });
  });

  it('sin sesión ni userId: error claro y nada encolado', async () => {
    await expect(submitWrite('shiftCard.edit', edicion, { waitMs: 0 })).rejects.toThrow(/sesión/);
    expect(await db.outbox.count()).toBe(0);
  });
});
