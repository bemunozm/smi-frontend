import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { waitFor } from '@testing-library/react';

const { openCardMock, closeCardMock, sendExitReportMock, uploadFileMock, toastMock } = vi.hoisted(() => ({
  openCardMock: vi.fn(),
  closeCardMock: vi.fn(),
  sendExitReportMock: vi.fn(),
  uploadFileMock: vi.fn(),
  toastMock: vi.fn(),
}));

vi.mock('../api/ShiftCardAPI', () => ({
  ShiftCardAPI: { openCard: openCardMock, closeCard: closeCardMock, listMine: vi.fn() },
}));
vi.mock('../api/ShiftReportAPI', () => ({
  ShiftReportAPI: { sendExitReport: sendExitReportMock, fileUrl: (id: string) => `/reports/${id}` },
}));
vi.mock('../api/UploadsAPI', () => ({ uploadFile: uploadFileMock }));
vi.mock('@heroui/react', () => ({ toast: Object.assign(toastMock, { danger: vi.fn(), success: vi.fn() }) }));

import { db, type CloseCardOp, type OpenCardOp, type SendExitReportOp } from './db';
import { countPending, retryOp } from './outbox';
import { requestSync, setCurrentUser, useEngineStoreForTests } from './replay';
import { SHIFT_CARDS_MINE_KEY } from '../hooks/useShiftCards';
import { DomainError } from '../lib/api-error';
import { queryClient } from '../lib/query-client';
import type { ShiftCardResponse, ShiftReportResponse } from '../types/shift';

function baseCard(overrides: Partial<ShiftCardResponse> = {}): ShiftCardResponse {
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
    valorFinal: null,
    horasMaquina: null,
    fuelLiters: null,
    pumpPhotoUrl: null,
    observaciones: null,
    belowPreviousReading: false,
    fecha: '2026-09-24T09:00:00.000Z',
    fechaSalida: null,
    createdAt: '2026-09-24T09:00:00.000Z',
    closedAt: null,
    ...overrides,
  };
}

function putOpenOp(overrides: Partial<OpenCardOp> = {}): Promise<string> {
  const base: OpenCardOp = {
    id: 'card-1',
    type: 'openCard',
    v: 1,
    userId: 'u1',
    status: 'pending',
    attempts: 0,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    payload: {
      id: 'card-1',
      equipoId: 'eq-1',
      operatorId: 'op-1',
      valorInicial: 100,
      shiftDate: '2026-09-24',
      shiftType: 'DIURNO',
      capturedAt: '2026-09-24T09:00:00.000Z',
    },
    ...overrides,
  };
  return db.outbox.put(base);
}

function putCloseOp(overrides: Partial<CloseCardOp> = {}): Promise<string> {
  const base: CloseCardOp = {
    id: 'close-1',
    type: 'closeCard',
    v: 1,
    userId: 'u1',
    status: 'pending_upload',
    attempts: 0,
    photoId: 'close-1',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    payload: {
      cardId: 'card-1',
      input: { closeClientId: 'close-1', valorFinal: 130, fuelLiters: 20, capturedAt: '2026-09-24T16:00:00.000Z' },
    },
    ...overrides,
  };
  return db.outbox.put(base);
}

function putReportOp(overrides: Partial<SendExitReportOp> = {}): Promise<string> {
  const base: SendExitReportOp = {
    id: 'report-1',
    type: 'sendExitReport',
    v: 1,
    userId: 'u1',
    status: 'pending',
    attempts: 0,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    payload: {
      id: 'report-1',
      shiftDate: '2026-09-24',
      shiftType: 'DIURNO',
      cardIds: ['card-1'],
      requestedAt: '2026-09-24T20:00:00.000Z',
    },
    ...overrides,
  };
  return db.outbox.put(base);
}

async function putPhoto(id = 'close-1') {
  await db.photos.put({ id, data: new Uint8Array([1, 2, 3]).buffer, mime: 'image/jpeg', name: 'x.jpg', createdAt: Date.now() });
}

beforeEach(async () => {
  await db.outbox.clear();
  await db.photos.clear();
  queryClient.clear();
  useEngineStoreForTests.setState({ syncing: false, authRequired: false, lastSyncAt: null, lastError: null });
  setCurrentUser(null);
});

afterEach(() => {
  vi.clearAllMocks();
  setCurrentUser(null);
});

/**
 * Dispara un intento y espera a que el motor termine. Espera `lastSyncAt`
 * (no `syncing`): `syncing` es un booleano transitorio — si el run ya
 * terminó antes de que el test alcance a mirarlo (mocks que resuelven
 * sincrónico-rápido), `waitFor(() => syncing === false)` podría pasar en su
 * primer chequeo SIN que el run siquiera haya arrancado, dando un falso
 * positivo. `lastSyncAt` en cambio arranca en `null` (reseteado en
 * `beforeEach`) y SOLO un run que llegó al final de su loop lo fija — sin
 * ambigüedad entre "todavía no empezó" y "ya terminó".
 */
async function syncAndSettle(userId = 'u1') {
  setCurrentUser(userId);
  requestSync();
  await waitFor(() => expect(useEngineStoreForTests.getState().lastSyncAt).not.toBeNull(), { timeout: 3000 });
}

describe('replay — orden y alcance', () => {
  it('procesa FIFO por createdAt', async () => {
    const order: string[] = [];
    openCardMock.mockImplementation((input: { id: string }) => {
      order.push(input.id);
      return Promise.resolve(baseCard({ id: input.id }));
    });

    await putOpenOp({ id: 'c-1', createdAt: 100, payload: { id: 'c-1', equipoId: 'eq-1', operatorId: 'op-1', valorInicial: 1, shiftDate: '2026-09-24', shiftType: 'DIURNO', capturedAt: 't' } });
    await putOpenOp({ id: 'c-2', createdAt: 200, payload: { id: 'c-2', equipoId: 'eq-2', operatorId: 'op-1', valorInicial: 1, shiftDate: '2026-09-24', shiftType: 'DIURNO', capturedAt: 't' } });
    await putOpenOp({ id: 'c-3', createdAt: 50, payload: { id: 'c-3', equipoId: 'eq-3', operatorId: 'op-1', valorInicial: 1, shiftDate: '2026-09-24', shiftType: 'DIURNO', capturedAt: 't' } });

    await syncAndSettle();

    expect(order).toEqual(['c-3', 'c-1', 'c-2']);
  });

  it('solo procesa las operaciones del usuario de la sesión', async () => {
    openCardMock.mockImplementation((input: { id: string }) => Promise.resolve(baseCard({ id: input.id })));
    await putOpenOp({ id: 'mio', userId: 'u1', payload: { id: 'mio', equipoId: 'eq-1', operatorId: 'op-1', valorInicial: 1, shiftDate: '2026-09-24', shiftType: 'DIURNO', capturedAt: 't' } });
    await putOpenOp({ id: 'ajeno', userId: 'u2', payload: { id: 'ajeno', equipoId: 'eq-1', operatorId: 'op-1', valorInicial: 1, shiftDate: '2026-09-24', shiftType: 'DIURNO', capturedAt: 't' } });

    await syncAndSettle('u1');

    expect(openCardMock).toHaveBeenCalledTimes(1);
    expect(openCardMock).toHaveBeenCalledWith(expect.objectContaining({ id: 'mio' }), expect.anything());
    expect(await db.outbox.get('ajeno')).toBeTruthy();
  });
});

describe('replay — éxito', () => {
  it('openCard: hace upsert en el caché de shift-cards/mine y borra la operación', async () => {
    queryClient.setQueryData(SHIFT_CARDS_MINE_KEY, [baseCard({ id: 'otra' })]);
    openCardMock.mockResolvedValueOnce(baseCard({ id: 'card-1' }));
    await putOpenOp();

    await syncAndSettle();

    expect(await db.outbox.get('card-1')).toBeUndefined();
    const cache = queryClient.getQueryData<ShiftCardResponse[]>(SHIFT_CARDS_MINE_KEY);
    expect(cache?.map((c) => c.id).sort()).toEqual(['card-1', 'otra']);
  });

  it('manda X-Client-Time y JAMÁS reescribe `capturedAt` (se manda el del payload original)', async () => {
    openCardMock.mockResolvedValueOnce(baseCard());
    await putOpenOp({
      payload: {
        id: 'card-1',
        equipoId: 'eq-1',
        operatorId: 'op-1',
        valorInicial: 100,
        shiftDate: '2026-09-24',
        shiftType: 'DIURNO',
        capturedAt: '2026-09-24T09:00:00.000Z',
      },
    });

    await syncAndSettle();

    expect(openCardMock).toHaveBeenCalledTimes(1);
    const [payload, config] = openCardMock.mock.calls[0]!;
    expect(payload.capturedAt).toBe('2026-09-24T09:00:00.000Z');
    expect(config.headers['X-Client-Time']).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(config.timeout).toBe(20_000);
  });
});

describe('replay — errores transitorios (red/5xx/429)', () => {
  it.each([
    ['error de red (sin status)', new DomainError('Network Error')],
    ['500', new DomainError('boom', { status: 500 })],
    ['429', new DomainError('too many', { status: 429 })],
  ])('%s: la operación queda pending, suma un intento, y el run se corta', async (_label, error) => {
    openCardMock.mockRejectedValueOnce(error);
    await putOpenOp({ id: 'c-1', createdAt: 1, payload: { id: 'c-1', equipoId: 'eq-1', operatorId: 'op-1', valorInicial: 1, shiftDate: '2026-09-24', shiftType: 'DIURNO', capturedAt: 't' } });
    await putOpenOp({ id: 'c-2', createdAt: 2, payload: { id: 'c-2', equipoId: 'eq-2', operatorId: 'op-1', valorInicial: 1, shiftDate: '2026-09-24', shiftType: 'DIURNO', capturedAt: 't' } });

    await syncAndSettle();

    const op1 = await db.outbox.get('c-1');
    expect(op1?.status).toBe('pending');
    expect(op1?.attempts).toBe(1);
    // El run se corta: la SEGUNDA operación ni se tocó.
    expect(openCardMock).toHaveBeenCalledTimes(1);
    expect(useEngineStoreForTests.getState().lastError?.message).toBeTruthy();
  });
});

describe('replay — 401', () => {
  it('pausa la cola entera (authRequired) y no toca las operaciones siguientes', async () => {
    openCardMock.mockRejectedValueOnce(new DomainError('no autorizado', { status: 401 }));
    await putOpenOp({ id: 'c-1', createdAt: 1, payload: { id: 'c-1', equipoId: 'eq-1', operatorId: 'op-1', valorInicial: 1, shiftDate: '2026-09-24', shiftType: 'DIURNO', capturedAt: 't' } });
    await putOpenOp({ id: 'c-2', createdAt: 2, payload: { id: 'c-2', equipoId: 'eq-2', operatorId: 'op-1', valorInicial: 1, shiftDate: '2026-09-24', shiftType: 'DIURNO', capturedAt: 't' } });

    await syncAndSettle();

    expect(useEngineStoreForTests.getState().authRequired).toBe(true);
    expect((await db.outbox.get('c-1'))?.status).toBe('pending');
    expect(openCardMock).toHaveBeenCalledTimes(1);
  });
});

describe('replay — errores de negocio (4xx que no es 401)', () => {
  it('409 (ej. ID_CONFLICT): la operación queda needs_attention y el run CONTINÚA', async () => {
    openCardMock.mockRejectedValueOnce(new DomainError('Ya existe', { status: 409, code: 'ID_CONFLICT' }));
    openCardMock.mockResolvedValueOnce(baseCard({ id: 'c-2' }));
    await putOpenOp({ id: 'c-1', createdAt: 1, payload: { id: 'c-1', equipoId: 'eq-1', operatorId: 'op-1', valorInicial: 1, shiftDate: '2026-09-24', shiftType: 'DIURNO', capturedAt: 't' } });
    await putOpenOp({ id: 'c-2', createdAt: 2, payload: { id: 'c-2', equipoId: 'eq-2', operatorId: 'op-1', valorInicial: 1, shiftDate: '2026-09-24', shiftType: 'DIURNO', capturedAt: 't' } });

    await syncAndSettle();

    const op1 = await db.outbox.get('c-1');
    expect(op1?.status).toBe('needs_attention');
    expect(op1?.lastError).toMatchObject({ code: 'ID_CONFLICT' });
    // Sigue con la siguiente — no se corta el run.
    expect(openCardMock).toHaveBeenCalledTimes(2);
    expect(await db.outbox.get('c-2')).toBeUndefined();
  });
});

describe('replay — cierre de tarjeta', () => {
  it('sube la foto (pending_upload → pending_claim) y después cierra', async () => {
    uploadFileMock.mockResolvedValueOnce({ key: 'tmp/u1/foto.jpg', url: 'https://x' });
    closeCardMock.mockResolvedValueOnce(baseCard({ id: 'card-1', valorFinal: 130, closedAt: '2026-09-24T16:00:00.000Z' }));
    await putCloseOp();
    await putPhoto();

    await syncAndSettle();

    expect(uploadFileMock).toHaveBeenCalledTimes(1);
    const [, uploadConfig] = uploadFileMock.mock.calls[0]!;
    expect(uploadConfig.timeout).toBe(60_000);
    expect(closeCardMock).toHaveBeenCalledWith(
      'card-1',
      expect.objectContaining({ tmpPhotoKey: 'tmp/u1/foto.jpg', closeClientId: 'close-1' }),
      expect.anything(),
    );
    expect(await db.outbox.get('close-1')).toBeUndefined();
    expect(await db.photos.get('close-1')).toBeUndefined();
  });

  it('TMP_KEY_EXPIRED: limpia la key, vuelve a pending_upload y RESUBE una vez en el mismo run', async () => {
    uploadFileMock.mockResolvedValueOnce({ key: 'tmp/vencida.jpg', url: 'https://x' });
    closeCardMock.mockRejectedValueOnce(new DomainError('expiró', { status: 400, code: 'TMP_KEY_EXPIRED' }));
    uploadFileMock.mockResolvedValueOnce({ key: 'tmp/nueva.jpg', url: 'https://x' });
    closeCardMock.mockResolvedValueOnce(baseCard({ id: 'card-1', valorFinal: 130, closedAt: '2026-09-24T16:00:00.000Z' }));
    await putCloseOp();
    await putPhoto();

    await syncAndSettle();

    expect(uploadFileMock).toHaveBeenCalledTimes(2);
    expect(closeCardMock).toHaveBeenCalledTimes(2);
    expect(closeCardMock).toHaveBeenNthCalledWith(1, 'card-1', expect.objectContaining({ tmpPhotoKey: 'tmp/vencida.jpg' }), expect.anything());
    expect(closeCardMock).toHaveBeenNthCalledWith(2, 'card-1', expect.objectContaining({ tmpPhotoKey: 'tmp/nueva.jpg' }), expect.anything());
    expect(await db.outbox.get('close-1')).toBeUndefined();
  });
});

describe('replay — reporte de salida', () => {
  it('éxito: borra la operación y hace upsert de `shift.exitReports` en la tarjeta', async () => {
    queryClient.setQueryData(SHIFT_CARDS_MINE_KEY, [baseCard({ id: 'card-1' })]);
    const report: ShiftReportResponse = {
      id: 'report-1',
      shiftId: 'sh-1',
      fileName: 'reporte.pdf',
      cardCount: 1,
      requestedAt: '2026-09-24T20:00:00.000Z',
      createdAt: '2026-09-24T20:00:01.000Z',
      emailStatus: 'SENT',
      missingCardIds: [],
    };
    sendExitReportMock.mockResolvedValueOnce(report);
    await putReportOp();

    await syncAndSettle();

    expect(await db.outbox.get('report-1')).toBeUndefined();
    const cache = queryClient.getQueryData<ShiftCardResponse[]>(SHIFT_CARDS_MINE_KEY);
    expect(cache?.[0]?.shift?.exitReports).toEqual([
      { id: 'report-1', requestedAt: report.requestedAt, cardCount: 1, emailStatus: 'SENT' },
    ]);
  });
});

describe('replay — candado', () => {
  it('un segundo trigger mientras el primero sigue en vuelo no procesa nada por su cuenta', async () => {
    let resolveFirst: (card: ShiftCardResponse) => void = () => {};
    const pending = new Promise<ShiftCardResponse>((resolve) => {
      resolveFirst = resolve;
    });
    openCardMock.mockImplementationOnce(() => pending);
    await putOpenOp({ id: 'c-1', createdAt: 1, payload: { id: 'c-1', equipoId: 'eq-1', operatorId: 'op-1', valorInicial: 1, shiftDate: '2026-09-24', shiftType: 'DIURNO', capturedAt: 't' } });

    setCurrentUser('u1');
    requestSync();
    await waitFor(() => expect(openCardMock).toHaveBeenCalledTimes(1));

    // Un segundo disparador mientras el primero sigue esperando la respuesta.
    requestSync();
    await new Promise((r) => setTimeout(r, 30));
    // Todavía solo UNA llamada: el candado (`fallbackLockHeld`, sin
    // `navigator.locks` en jsdom) impidió que el segundo intento arrancara
    // un run en paralelo.
    expect(openCardMock).toHaveBeenCalledTimes(1);

    resolveFirst(baseCard({ id: 'card-1' }));
    await waitFor(() => expect(useEngineStoreForTests.getState().syncing).toBe(false));
  });

  /**
   * Disparador perdido (revisión de la Fase 5, ítem 4): un `requestSync()`
   * que llega con el candado ocupado NO debe dejar la operación recién
   * encolada esperando hasta el próximo disparador externo (45 s / online /
   * visibilitychange). Esta prueba verifica el CONTRATO observable — c-2
   * termina sincronizada sin que el test dispare nada más — sin importar si
   * la agarra el loop FIFO del mismo run (que también puede alcanzar a
   * verla, según el timing exacto) o el `rerunRequested` que pide un run
   * extra al terminar: la ventana exacta que el bug describe (agregada
   * DESPUÉS del último `nextPendingOp` del loop pero ANTES de soltar el
   * candado) es de apenas un puñado de sentencias síncronas y no se puede
   * aislar de forma determinística desde afuera sin instrumentar el motor.
   * Lo que sí es 100% verificable, y es lo que le importa al supervisor: que
   * NINGÚN camino la deja esperando.
   */
  it('un requestSync() que encuentra el candado ocupado no se pierde: lo nuevo se sincroniza sin esperar otro disparador', async () => {
    let resolveFirst: (card: ShiftCardResponse) => void = () => {};
    const pending = new Promise<ShiftCardResponse>((resolve) => {
      resolveFirst = resolve;
    });
    openCardMock.mockImplementationOnce(() => pending);
    openCardMock.mockImplementationOnce((input: { id: string }) => Promise.resolve(baseCard({ id: input.id })));

    await putOpenOp({ id: 'c-1', createdAt: 1, payload: { id: 'c-1', equipoId: 'eq-1', operatorId: 'op-1', valorInicial: 1, shiftDate: '2026-09-24', shiftType: 'DIURNO', capturedAt: 't' } });

    setCurrentUser('u1');
    requestSync();
    await waitFor(() => expect(openCardMock).toHaveBeenCalledTimes(1));

    // Mientras el primer run sigue con el candado tomado (todavía esperando
    // la respuesta de c-1), se encola una segunda operación — el mismo
    // patrón que `offline/outbox.ts#enqueueOpenCard` (guardar + `requestSync()`).
    await putOpenOp({ id: 'c-2', createdAt: 2, payload: { id: 'c-2', equipoId: 'eq-2', operatorId: 'op-1', valorInicial: 1, shiftDate: '2026-09-24', shiftType: 'DIURNO', capturedAt: 't' } });
    requestSync();

    resolveFirst(baseCard({ id: 'c-1' }));

    await waitFor(() => expect(openCardMock).toHaveBeenCalledTimes(2), { timeout: 3000 });
    expect(await db.outbox.get('c-2')).toBeUndefined();
  });
});

describe('replay — operación atascada en "syncing" (bug crítico)', () => {
  /**
   * Si la pestaña/PWA muere a mitad de una request, la operación queda en
   * `'syncing'` en Dexie — y `nextPendingOp` la excluye a propósito (para no
   * procesarla dos veces DENTRO del mismo run). Sin el reseteo al empezar
   * `runReplay`, ningún run futuro la vuelve a mirar: queda atascada para
   * siempre, bloquea el logout (`countPending` la cuenta) y su foto nunca se
   * borra. El servidor es idempotente, así que reenviarla es seguro.
   */
  it('una operación que quedó en `syncing` de un run anterior se reintenta y se procesa', async () => {
    openCardMock.mockResolvedValueOnce(baseCard({ id: 'card-1' }));
    await putOpenOp({ status: 'syncing' });

    await syncAndSettle();

    expect(openCardMock).toHaveBeenCalledTimes(1);
    expect(await db.outbox.get('card-1')).toBeUndefined();
  });

  it('un cierre atascado en `syncing` vuelve a `pending_claim` (no a `pending_upload`) si ya tenía `tmpKey`', async () => {
    closeCardMock.mockResolvedValueOnce(baseCard({ id: 'card-1', valorFinal: 130, closedAt: '2026-09-24T16:00:00.000Z' }));
    await putCloseOp({ status: 'syncing', tmpKey: 'tmp/u1/ya-subida.jpg' });
    await putPhoto();

    await syncAndSettle();

    // Ya tenía la key subida — no debe volver a llamar a `uploadFile`.
    expect(uploadFileMock).not.toHaveBeenCalled();
    expect(closeCardMock).toHaveBeenCalledWith(
      'card-1',
      expect.objectContaining({ tmpPhotoKey: 'tmp/u1/ya-subida.jpg' }),
      expect.anything(),
    );
    expect(await db.outbox.get('close-1')).toBeUndefined();
  });

  it('no bloquea el logout: `countPending` deja de contarla una vez sincronizada', async () => {
    openCardMock.mockResolvedValueOnce(baseCard({ id: 'card-1' }));
    await putOpenOp({ status: 'syncing' });

    expect(await countPending('u1')).toBe(1);

    await syncAndSettle();

    expect(await countPending('u1')).toBe(0);
  });
});

describe('replay — tmpKey se conserva tras un error posterior a la subida (revisión Fase 5, ítem 2)', () => {
  it('un error TRANSITORIO en el POST de cierre, después de subir la foto, NO borra el tmpKey ni resube en el próximo run', async () => {
    uploadFileMock.mockResolvedValueOnce({ key: 'tmp/u1/foto.jpg', url: 'https://x' });
    closeCardMock.mockRejectedValueOnce(new DomainError('Network Error')); // sin status = transitorio
    await putCloseOp();
    await putPhoto();

    await syncAndSettle();

    // La subida ya pasó — el `tmpKey` tiene que haber sobrevivido al error
    // posterior (antes se perdía: `handleOpError` recibía el `op` VIEJO, sin
    // `tmpKey`, y `put({...op})` lo pisaba).
    const op = await db.outbox.get('close-1');
    expect(op?.status).toBe('pending_claim');
    expect((op as { tmpKey?: string })?.tmpKey).toBe('tmp/u1/foto.jpg');
    expect(uploadFileMock).toHaveBeenCalledTimes(1);

    // Segundo run: NO debe volver a subir la foto — solo reintentar el cierre.
    closeCardMock.mockResolvedValueOnce(baseCard({ id: 'card-1', valorFinal: 130, closedAt: '2026-09-24T16:00:00.000Z' }));
    useEngineStoreForTests.setState({ lastSyncAt: null });

    await syncAndSettle();

    expect(uploadFileMock).toHaveBeenCalledTimes(1);
    expect(closeCardMock).toHaveBeenCalledTimes(2);
    expect(closeCardMock).toHaveBeenNthCalledWith(
      2,
      'card-1',
      expect.objectContaining({ tmpPhotoKey: 'tmp/u1/foto.jpg' }),
      expect.anything(),
    );
    expect(await db.outbox.get('close-1')).toBeUndefined();
  });
});

describe('replay — clasificación de errores sin status (revisión Fase 5, ítem 3)', () => {
  it('PHOTO_MISSING (falta la foto guardada): queda needs_attention, no se retiene reintentando para siempre', async () => {
    await putCloseOp(); // sin `putPhoto()`: la fila de `photos` no existe

    await syncAndSettle();

    const op = await db.outbox.get('close-1');
    expect(op?.status).toBe('needs_attention');
    expect(op?.lastError).toMatchObject({ code: 'PHOTO_MISSING' });
    expect(uploadFileMock).not.toHaveBeenCalled();
  });

  it('INVALID_RESPONSE (respuesta que no calza con el contrato, ej. ZodError): needs_attention y el run CONTINÚA', async () => {
    openCardMock.mockRejectedValueOnce(new DomainError('Respuesta inválida: x', { code: 'INVALID_RESPONSE' }));
    openCardMock.mockResolvedValueOnce(baseCard({ id: 'c-2' }));
    await putOpenOp({ id: 'c-1', createdAt: 1, payload: { id: 'c-1', equipoId: 'eq-1', operatorId: 'op-1', valorInicial: 1, shiftDate: '2026-09-24', shiftType: 'DIURNO', capturedAt: 't' } });
    await putOpenOp({ id: 'c-2', createdAt: 2, payload: { id: 'c-2', equipoId: 'eq-2', operatorId: 'op-1', valorInicial: 1, shiftDate: '2026-09-24', shiftType: 'DIURNO', capturedAt: 't' } });

    await syncAndSettle();

    const op1 = await db.outbox.get('c-1');
    expect(op1?.status).toBe('needs_attention');
    expect(op1?.lastError).toMatchObject({ code: 'INVALID_RESPONSE' });
    // Sigue con la siguiente — antes esto clasificaba como transitorio
    // (sin `status`) y trababa la cola para siempre.
    expect(openCardMock).toHaveBeenCalledTimes(2);
    expect(await db.outbox.get('c-2')).toBeUndefined();
  });
});

describe('replay — 429 REPORT_RATE_LIMITED (revisión Fase 5, ítem 5)', () => {
  it('con code REPORT_RATE_LIMITED: needs_attention, no reintenta en bucle', async () => {
    sendExitReportMock.mockRejectedValueOnce(new DomainError('Demasiados reportes', { status: 429, code: 'REPORT_RATE_LIMITED' }));
    await putReportOp();

    await syncAndSettle();

    const op = await db.outbox.get('report-1');
    expect(op?.status).toBe('needs_attention');
    expect(op?.lastError).toMatchObject({ code: 'REPORT_RATE_LIMITED' });
  });

  it('un 429 SIN ese code sigue siendo transitorio (pending + intento, run cortado)', async () => {
    sendExitReportMock.mockRejectedValueOnce(new DomainError('Too Many Requests', { status: 429 }));
    await putReportOp();

    await syncAndSettle();

    const op = await db.outbox.get('report-1');
    expect(op?.status).toBe('pending');
    expect(op?.attempts).toBe(1);
  });
});

describe('replay — cierre cuya apertura falló (revisión QA, "no lo mandes, ligalos")', () => {
  /**
   * Escenario: sin señal, el supervisor abre la tarjeta X y la cierra — las
   * dos operaciones quedan en el outbox. Al reintentar, `openCard(X)` recibe
   * un error de NEGOCIO (ej. 409 `EQUIPMENT_BUSY`, otro supervisor tomó el
   * equipo mientras tanto) → `needs_attention`. Mandar igual el `closeCard`
   * de esa `cardId` solo le garantiza al backend un 404 `CARD_NOT_FOUND` —
   * esa tarjeta nunca llegó a existir. `nextPendingOp` los liga por
   * `payload.cardId === openCard.id` y retiene el cierre SIN tocar su
   * `status` mientras la apertura siga en `needs_attention`.
   */
  it('el cierre se salta mientras su apertura sigue en needs_attention — no se manda, no cambia de estado', async () => {
    await putOpenOp({ status: 'needs_attention', lastError: { message: 'CA-011 ocupado', code: 'EQUIPMENT_BUSY' } });
    await putCloseOp(); // payload.cardId 'card-1' — la misma que la apertura bloqueada
    await putPhoto();

    await syncAndSettle();

    expect(closeCardMock).not.toHaveBeenCalled();
    expect(uploadFileMock).not.toHaveBeenCalled();
    expect((await db.outbox.get('close-1'))?.status).toBe('pending_upload');
    expect((await db.outbox.get('card-1'))?.status).toBe('needs_attention');
  });

  it('tras un retryOp exitoso sobre la apertura, el cierre se sincroniza solo, sin tocarlo directamente', async () => {
    openCardMock.mockResolvedValueOnce(baseCard({ id: 'card-1' }));
    uploadFileMock.mockResolvedValueOnce({ key: 'tmp/u1/foto.jpg', url: 'https://x' });
    closeCardMock.mockResolvedValueOnce(baseCard({ id: 'card-1', valorFinal: 130, closedAt: '2026-09-24T16:00:00.000Z' }));
    await putOpenOp({ status: 'needs_attention' });
    await putCloseOp();
    await putPhoto();

    await retryOp('card-1', 'u1');
    await syncAndSettle();

    expect(openCardMock).toHaveBeenCalledTimes(1);
    expect(closeCardMock).toHaveBeenCalledTimes(1);
    expect(await db.outbox.get('card-1')).toBeUndefined();
    expect(await db.outbox.get('close-1')).toBeUndefined();
  });

  it('operaciones sin relación con el bloqueo siguen sincronizando (FIFO del resto intacto)', async () => {
    openCardMock.mockImplementation((input: { id: string }) => Promise.resolve(baseCard({ id: input.id })));
    await putOpenOp({ status: 'needs_attention' }); // card-1, bloqueada
    await putCloseOp(); // close-1, depende de card-1 — retenido
    await putOpenOp({
      id: 'card-9',
      createdAt: 999,
      payload: {
        id: 'card-9',
        equipoId: 'eq-9',
        operatorId: 'op-1',
        valorInicial: 1,
        shiftDate: '2026-09-24',
        shiftType: 'DIURNO',
        capturedAt: 't',
      },
    });
    await putPhoto();

    await syncAndSettle();

    expect(openCardMock).toHaveBeenCalledTimes(1);
    expect(openCardMock).toHaveBeenCalledWith(expect.objectContaining({ id: 'card-9' }), expect.anything());
    expect(await db.outbox.get('card-9')).toBeUndefined();
    // el par bloqueado sigue exactamente como estaba — nadie lo tocó.
    expect((await db.outbox.get('close-1'))?.status).toBe('pending_upload');
    expect((await db.outbox.get('card-1'))?.status).toBe('needs_attention');
  });
});
