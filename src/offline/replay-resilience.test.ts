import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';

const { sendWriteMock, sendExitReportMock, openCardMock, closeCardMock, uploadFileMock, loggerErrorMock } =
  vi.hoisted(() => ({
    sendWriteMock: vi.fn(),
    sendExitReportMock: vi.fn(),
    openCardMock: vi.fn(),
    closeCardMock: vi.fn(),
    uploadFileMock: vi.fn(),
    loggerErrorMock: vi.fn(),
  }));

vi.mock('../api/WriteAPI', () => ({ sendWrite: sendWriteMock }));
vi.mock('../api/ShiftReportAPI', () => ({
  ShiftReportAPI: { sendExitReport: sendExitReportMock, fileUrl: (id: string) => `/r/${id}` },
}));
vi.mock('../api/ShiftCardAPI', () => ({
  ShiftCardAPI: { openCard: openCardMock, closeCard: closeCardMock, listMine: vi.fn() },
}));
vi.mock('../api/HallazgosAPI', () => ({ createHallazgo: vi.fn(), listHallazgos: vi.fn() }));
vi.mock('../api/TrabajosExtraAPI', () => ({ createTrabajoExtra: vi.fn(), listTrabajosExtra: vi.fn() }));
// El `uploadFile` real (valida tipo y tamaño antes de hablar con la red); la prueba lo
// reemplaza solo cuando necesita simular un fallo de red.
vi.mock('../api/UploadsAPI', async (importOriginal) => {
  const real = await importOriginal<typeof import('../api/UploadsAPI')>();
  uploadFileMock.mockImplementation(real.uploadFile);
  return { ...real, uploadFile: uploadFileMock };
});
vi.mock('../lib/logger', () => ({ logger: { error: loggerErrorMock } }));

import { db, itemEntity, type OutboxOp } from './db';
import { ENDPOINTS } from './endpoints';
import {
  discardOp,
  enqueueCloseCard,
  enqueueExitReport,
  enqueueHttpWrite,
  enqueueOpenCard,
  overwriteOp,
  patchOpenCardOp,
  escriturasPendientes,
} from './outbox';
import {
  requestSync,
  resetReplayEngineForTests,
  setCurrentUser,
  uploadTimeoutMs,
  useSyncEngine,
  useEngineStoreForTests,
  waitForOutcome,
} from './replay';
import { submitWrite } from './submit-write';
import { DomainError } from '../lib/api-error';
import { queryClient } from '../lib/query-client';

const U = 'u1';

async function runOnce(): Promise<void> {
  useEngineStoreForTests.setState({ lastSyncAt: null });
  requestSync();
  await waitFor(() => expect(useEngineStoreForTests.getState().lastSyncAt).not.toBeNull(), { timeout: 4000 });
}

/** Una escritura genérica sobre una categoría (`DELETE`), independiente de las demás. */
function borrarCategoria(id: string, categoria: string) {
  return enqueueHttpWrite(U, {
    id,
    endpoint: 'category.delete',
    params: { id: categoria },
    body: {},
    label: `Eliminación ${categoria}`,
  });
}

const SIN_SENAL = () => new DomainError('Network Error');

beforeEach(async () => {
  resetReplayEngineForTests();
  for (const mock of [sendWriteMock, sendExitReportMock, openCardMock, closeCardMock, loggerErrorMock]) {
    mock.mockReset();
  }
  uploadFileMock.mockClear();
  await db.outbox.clear();
  await db.blobs.clear();
  queryClient.clear();
  window.localStorage.clear();
  setCurrentUser(U);
  // `setCurrentUser` pide un sync; se espera a que termine antes de armar el escenario.
  await waitFor(() => expect(useEngineStoreForTests.getState().lastSyncAt).not.toBeNull(), { timeout: 4000 });
});

afterEach(async () => {
  // Un guardado que no espera (sin red, o liberado por un fallo transitorio) deja su run
  // corriendo en segundo plano: se lo deja terminar para que no se solape con el siguiente test.
  await waitFor(() => expect(useEngineStoreForTests.getState().syncing).toBe(false));
  await new Promise((resolve) => setTimeout(resolve, 15));
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  setCurrentUser(null);
});

describe('ROB ALTO-1 — un archivo que el servidor no aceptará no traba la cola', () => {
  it('una foto de más de 8 MB ya guardada: va a "requiere atención" con el motivo REAL, y la de atrás sale', async () => {
    const ahora = Date.now();
    // Lo que dejaba `enqueueCreateHallazgo` cuando la compresión caía a los bytes originales.
    await db.blobs.put({ id: 'h1', data: new ArrayBuffer(9 * 1024 * 1024), mime: 'image/jpeg', name: 'h.jpg', createdAt: ahora });
    await db.outbox.put({
      id: 'h1', type: 'createHallazgo', v: 1, userId: U, status: 'pending_upload', attempts: 0, seq: ahora,
      entityKey: 'hallazgo:h1', photoId: 'h1', createdAt: ahora, updatedAt: ahora, payload: { id: 'h1' },
    } as never);
    await db.outbox.put({
      id: 'rep1', type: 'sendExitReport', v: 1, userId: U, status: 'pending', attempts: 0, seq: ahora + 1,
      createdAt: ahora, updatedAt: ahora, payload: { id: 'rep1', cardIds: [] },
    } as never);
    sendExitReportMock.mockResolvedValue({ id: 'rep1', requestedAt: 't', cardCount: 0, emailStatus: 'SENT', missingCardIds: [] });

    await runOnce();

    const hallazgo = await db.outbox.get('h1');
    expect(hallazgo?.status).toBe('needs_attention');
    expect(hallazgo?.lastError).toMatchObject({ code: 'FILE_TOO_LARGE', message: 'El archivo supera el máximo de 8 MB.' });
    expect(hallazgo?.lastError?.message).not.toMatch(/Sin señal/);
    // La operación independiente de atrás salió en el mismo run.
    expect(sendExitReportMock).toHaveBeenCalledTimes(1);
    expect(await db.outbox.get('rep1')).toBeUndefined();

    // Y no queda sin salida: se puede descartar (con su foto).
    await discardOp('h1', U);
    expect(await db.outbox.count()).toBe(0);
    expect(await db.blobs.count()).toBe(0);
  });

  it('un formato no aceptado ya guardado también es de negocio', async () => {
    const ahora = Date.now();
    await db.blobs.put({ id: 'c1', data: new ArrayBuffer(10), mime: 'image/heic', name: 'c.heic', createdAt: ahora });
    await db.outbox.put({
      id: 'c1', type: 'closeCard', v: 1, userId: U, status: 'pending_upload', attempts: 0, seq: ahora,
      entityKey: 'shift-card:card-1', photoId: 'c1', createdAt: ahora, updatedAt: ahora,
      payload: { cardId: 'card-1', input: { closeClientId: 'c1' } },
    } as never);

    await runOnce();

    expect((await db.outbox.get('c1'))?.lastError?.code).toBe('FILE_TYPE_NOT_ALLOWED');
    expect((await db.outbox.get('c1'))?.status).toBe('needs_attention');
  });

  it('un 413 del servidor también es de negocio, no transitorio', async () => {
    uploadFileMock.mockRejectedValueOnce(new DomainError('grande', { code: 'FILE_TOO_LARGE', status: 413 }));
    const ahora = Date.now();
    await db.blobs.put({ id: 'h1', data: new ArrayBuffer(10), mime: 'image/jpeg', name: 'h.jpg', createdAt: ahora });
    await db.outbox.put({
      id: 'h1', type: 'createHallazgo', v: 1, userId: U, status: 'pending_upload', attempts: 0, seq: ahora,
      photoId: 'h1', createdAt: ahora, updatedAt: ahora, payload: { id: 'h1' },
    } as never);

    await runOnce();

    expect((await db.outbox.get('h1'))?.status).toBe('needs_attention');
  });
});

describe('ROB ALTO-2 — un fallo transitorio de UNA operación no corta el run entero', () => {
  it('la operación que falla queda pendiente y la independiente de atrás sale en el MISMO run', async () => {
    sendWriteMock.mockRejectedValueOnce(SIN_SENAL()).mockResolvedValue(true);
    await borrarCategoria('a', 'c1');
    await borrarCategoria('b', 'c2');

    await runOnce();

    expect((await db.outbox.get('a'))?.attempts).toBe(1);
    expect(await db.outbox.get('b')).toBeUndefined();
    expect(sendWriteMock).toHaveBeenCalledTimes(2);
  });

  it('retiene lo que depende de la que falló, y lo manda cuando esa por fin sale', async () => {
    sendWriteMock.mockImplementation(async (peticion: { url: string; method: string }) => {
      if (peticion.method === 'POST') throw SIN_SENAL();
      return true;
    });
    await enqueueHttpWrite(U, {
      id: 'cat-op', endpoint: 'category.create', params: {}, body: { id: 'cat-1', name: 'Filtros' }, label: 'Nueva categoría',
    });
    await enqueueHttpWrite(U, {
      id: 'cat-edit', endpoint: 'category.update', params: { id: 'cat-1' }, body: { name: 'Filtros 2' }, label: 'Edición',
    });
    await borrarCategoria('indep', 'otra');

    await runOnce();

    // La creación falló; su edición (misma entidad) no se intentó; la independiente salió.
    expect(sendWriteMock.mock.calls.map(([p]) => `${p.method} ${p.url}`)).toEqual([
      'POST /api/inventory/categories',
      'DELETE /api/inventory/categories/otra',
    ]);
    expect(await db.outbox.get('cat-edit')).toBeTruthy();

    sendWriteMock.mockResolvedValue({ id: 'cat-1', name: 'x' });
    await runOnce();
    expect(await db.outbox.count()).toBe(0);
  });

  it('si la red se cae a mitad del run el run se corta: no se gasta un intento por operación', async () => {
    sendWriteMock.mockImplementation(async () => {
      vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
      throw SIN_SENAL();
    });
    await borrarCategoria('a', 'c1');
    await borrarCategoria('b', 'c2');

    await runOnce();

    expect(sendWriteMock).toHaveBeenCalledTimes(1);
    expect((await db.outbox.get('b'))?.attempts).toBe(0);
  });

  it('sin red desde el principio un run no intenta NADA (ni gasta intentos) y se reanuda con el evento online', async () => {
    const enLinea = vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    sendWriteMock.mockResolvedValue(true);
    const { unmount } = renderHook(() => useSyncEngine(U));
    await borrarCategoria('a', 'c1');

    for (let i = 0; i < 5; i += 1) {
      requestSync();
      document.dispatchEvent(new Event('visibilitychange'));
      await new Promise((resolve) => setTimeout(resolve, 15));
    }
    expect(sendWriteMock).not.toHaveBeenCalled();
    expect((await db.outbox.get('a'))?.attempts).toBe(0);

    enLinea.mockReturnValue(true);
    window.dispatchEvent(new Event('online'));

    await waitFor(() => expect(sendWriteMock).toHaveBeenCalledTimes(1));
    expect(await db.outbox.count()).toBe(0);
    unmount();
  });

  it('un 401 corta el run y deja la sesión marcada como terminada', async () => {
    sendWriteMock.mockRejectedValue(new DomainError('no autorizado', { status: 401 }));
    await borrarCategoria('a', 'c1');
    await borrarCategoria('b', 'c2');

    await runOnce();

    expect(useEngineStoreForTests.getState().authRequired).toBe(true);
    expect(sendWriteMock).toHaveBeenCalledTimes(1);
    expect(JSON.parse(window.localStorage.getItem('smi-cache-owner') ?? 'null')).toBe('');
  });

  it('el timeout de subida crece con el tamaño del archivo, con tope', () => {
    expect(uploadTimeoutMs(0)).toBe(60_000);
    expect(uploadTimeoutMs(200 * 1024)).toBeGreaterThan(60_000);
    expect(uploadTimeoutMs(2 * 1024 * 1024)).toBe(120_000);
    expect(uploadTimeoutMs(8 * 1024 * 1024)).toBe(300_000);
    expect(uploadTimeoutMs(100 * 1024 * 1024)).toBe(300_000);
  });

  it('la subida de un archivo de 2 MB se manda con ese plazo', async () => {
    const ahora = Date.now();
    await db.blobs.put({ id: 'h1', data: new ArrayBuffer(2 * 1024 * 1024), mime: 'image/jpeg', name: 'h.jpg', createdAt: ahora });
    await db.outbox.put({
      id: 'h1', type: 'createHallazgo', v: 1, userId: U, status: 'pending_upload', attempts: 0, seq: ahora,
      photoId: 'h1', createdAt: ahora, updatedAt: ahora, payload: { id: 'h1' },
    } as never);
    uploadFileMock.mockRejectedValue(SIN_SENAL());

    await runOnce();

    expect(uploadFileMock.mock.calls[0]![1]).toMatchObject({ timeout: 120_000 });
  });

  it('el reporte de salida no se adelanta a un cierre que quedó retenido', async () => {
    uploadFileMock.mockRejectedValue(SIN_SENAL());
    openCardMock.mockResolvedValue({ id: 'card-1', equipoId: 'eq-1' });
    sendExitReportMock.mockResolvedValue({ id: 'rep-1', requestedAt: 't', cardCount: 1, emailStatus: 'SENT', missingCardIds: [] });
    await enqueueOpenCard(U, {
      id: 'card-1', equipoId: 'eq-1', operatorId: 'op-1', valorInicial: 1, shiftDate: '2026-09-24', shiftType: 'DIURNO', capturedAt: 't',
    });
    await enqueueCloseCard(
      U,
      'card-1',
      { closeClientId: 'close-1', valorFinal: 5, fuelLiters: 1, capturedAt: 't' },
      new File([new Uint8Array(100)], 'f.jpg', { type: 'image/jpeg' }),
    );
    await enqueueExitReport(U, { id: 'rep-1', shiftDate: '2026-09-24', shiftType: 'DIURNO', cardIds: ['card-1'], requestedAt: 't' });
    await borrarCategoria('indep', 'otra');
    sendWriteMock.mockResolvedValue(true);

    await runOnce();

    expect(openCardMock).toHaveBeenCalledTimes(1);
    expect(await db.outbox.get('close-1')).toBeTruthy(); // la foto no subió: retenido
    expect(sendExitReportMock).not.toHaveBeenCalled(); // y el reporte detrás de él
    expect(await db.outbox.get('indep')).toBeUndefined(); // lo independiente sí salió

    uploadFileMock.mockResolvedValue({ key: 'tmp/u1/x.jpg', url: 'u' });
    closeCardMock.mockResolvedValue({ id: 'card-1', equipoId: 'eq-1' });
    await runOnce();
    expect(sendExitReportMock).toHaveBeenCalledTimes(1);
    expect(await db.outbox.count()).toBe(0);
  });
});

describe('ROB ALTO-4 — una excepción DESPUÉS de la respuesta del servidor no es "sin señal"', () => {
  it('un fallo al escribir el caché de una escritura genérica: la operación se da por hecha, se registra y el run sigue', async () => {
    vi.spyOn(ENDPOINTS['category.delete'], 'applyResponse').mockImplementation(() => {
      throw new TypeError('Cannot read properties of undefined');
    });
    sendWriteMock.mockResolvedValue({});
    await borrarCategoria('a', 'c1');
    await borrarCategoria('b', 'c2');

    await runOnce();

    expect(await db.outbox.count()).toBe(0);
    expect(sendWriteMock).toHaveBeenCalledTimes(2); // cada una se mandó UNA vez, no en bucle
    expect(loggerErrorMock).toHaveBeenCalledTimes(2);
    expect(loggerErrorMock.mock.calls[0]![0]).toMatch(/aplicó/);
  });

  it('quien esperaba el resultado lo recibe como enviado', async () => {
    vi.spyOn(ENDPOINTS['category.delete'], 'applyResponse').mockImplementation(() => {
      throw new TypeError('boom');
    });
    sendWriteMock.mockResolvedValue({});

    const resultado = await submitWrite('category.delete', { params: { id: 'c1' }, body: {} }, { waitMs: 3000 });

    expect(resultado.status).toBe('sent');
    expect(await db.outbox.count()).toBe(0);
  });

  it('lo mismo con las operaciones que no pasan por el registro (apertura de tarjeta)', async () => {
    openCardMock.mockResolvedValue({ id: 'card-1', equipoId: 'eq-1' });
    vi.spyOn(queryClient, 'setQueryData').mockImplementation(() => {
      throw new TypeError('caché roto');
    });
    await enqueueOpenCard(U, {
      id: 'card-1', equipoId: 'eq-1', operatorId: 'op-1', valorInicial: 1, shiftDate: '2026-09-24', shiftType: 'DIURNO', capturedAt: 't',
    });

    await runOnce();

    expect(openCardMock).toHaveBeenCalledTimes(1);
    expect(await db.outbox.count()).toBe(0);
    expect(loggerErrorMock).toHaveBeenCalledTimes(1);
  });
});

describe('ROB MEDIO-6 — "Sobrescribir" una edición no hace chocar a la siguiente contra un cambio propio', () => {
  it('la edición de atrás se manda esperando el valor que la primera dejó', async () => {
    // Servidor falso con el contrato de X-Expected: pasa si actual == esperado o actual == deseado.
    const servidor = { name: 'Q' }; // otra persona la cambió de A a Q
    sendWriteMock.mockImplementation(async (peticion: { body: { name: string }; headers: Record<string, string> }) => {
      const encabezado = peticion.headers['X-Expected'];
      const esperado = encabezado ? JSON.parse(decodeURIComponent(encabezado)) : null;
      if (esperado && servidor.name !== esperado.name && servidor.name !== peticion.body.name) {
        throw new DomainError('stale', { status: 409, code: 'STALE_UPDATE' });
      }
      servidor.name = peticion.body.name;
      return { id: 'X' };
    });

    // Edición 1: A -> B (base A). Choca con Q.
    await enqueueHttpWrite(U, {
      id: 'e1', endpoint: 'item.update', params: { id: 'X' }, body: { name: 'B' }, expected: { name: 'A' }, label: 'e1',
    });
    await runOnce();
    expect((await db.outbox.get('e1'))?.status).toBe('needs_attention');

    // La persona sigue editando con la pantalla mostrando todavía A: base A, B -> C.
    expect(await escriturasPendientes(itemEntity('X'), ['item.update'], U)).toEqual([]);
    await enqueueHttpWrite(U, {
      id: 'e2', endpoint: 'item.update', params: { id: 'X' }, body: { name: 'C' }, expected: { name: 'A' }, label: 'e2',
    });
    sendWriteMock.mockClear();
    await runOnce();
    expect(sendWriteMock).not.toHaveBeenCalled(); // retenida detrás de e1

    await overwriteOp('e1', U);
    await runOnce();

    expect(servidor.name).toBe('C');
    expect(await db.outbox.count()).toBe(0);
    const e2 = sendWriteMock.mock.calls.at(-1)![0];
    expect(JSON.parse(decodeURIComponent(e2.headers['X-Expected']))).toEqual({ name: 'B' });
  });

  it('solo reajusta la precondición de la misma entidad y de los campos que la primera escribió', async () => {
    sendWriteMock.mockResolvedValue({ id: 'X' });
    await enqueueHttpWrite(U, {
      id: 'e1', endpoint: 'item.update', params: { id: 'X' }, body: { name: 'B' }, expected: { name: 'A' }, label: 'e1',
    });
    await enqueueHttpWrite(U, {
      id: 'e2', endpoint: 'item.update', params: { id: 'X' }, body: { name: 'C', description: 'd2' },
      expected: { name: 'A', description: 'd1' }, label: 'e2',
    });
    await enqueueHttpWrite(U, {
      id: 'otra', endpoint: 'item.update', params: { id: 'Y' }, body: { name: 'Z' }, expected: { name: 'A' }, label: 'otra',
    });
    // La primera quedó en atención (la rechazó el servidor) y la persona la sobrescribe.
    const e1 = await db.outbox.get('e1');
    if (!e1) throw new Error('setup inválido');
    await db.outbox.put({ ...e1, status: 'needs_attention', lastError: { message: 'x', code: 'STALE_UPDATE', status: 409 } });
    await overwriteOp('e1', U);
    sendWriteMock.mockClear();

    await runOnce();

    const segunda = sendWriteMock.mock.calls.find(([p]) => p.body.description === 'd2')![0];
    expect(JSON.parse(decodeURIComponent(segunda.headers['X-Expected']))).toEqual({ name: 'B', description: 'd1' });
    const ajena = sendWriteMock.mock.calls.find(([p]) => p.url.endsWith('/Y'))![0];
    expect(JSON.parse(decodeURIComponent(ajena.headers['X-Expected']))).toEqual({ name: 'A' });
  });
});

describe('ROB MEDIO-11 — el replay toma la copia FRESCA de la operación', () => {
  /** Hace que lo que se pasa a `antes` ocurra justo antes de la primera transacción del run. */
  function enLaPrimeraTransaccion(antes: () => Promise<unknown>): { huboCambio: () => boolean } {
    const original = db.transaction.bind(db) as (...args: unknown[]) => unknown;
    let hecho = false;
    vi.spyOn(db, 'transaction').mockImplementation(((...args: unknown[]) => {
      if (hecho) return original(...args);
      hecho = true;
      return antes().then(() => original(...args));
    }) as never);
    return { huboCambio: () => hecho };
  }

  const APERTURA = {
    id: 'card-1', equipoId: 'eq', operatorId: 'op', valorInicial: 100, shiftDate: '2026-09-24', shiftType: 'DIURNO' as const, capturedAt: 't',
  };

  it('una edición que cae entre elegir la operación y tomarla viaja al servidor', async () => {
    openCardMock.mockResolvedValue({ id: 'card-1', equipoId: 'eq' });
    await enqueueOpenCard(U, APERTURA);
    let resultado: string | null = null;
    enLaPrimeraTransaccion(async () => {
      resultado = await patchOpenCardOp('card-1', U, { valorInicial: 555 });
    });

    await runOnce();

    expect(resultado).toBe('updated');
    expect(openCardMock.mock.calls[0]![0].valorInicial).toBe(555);
  });

  it('una operación descartada en ese hueco no resucita', async () => {
    openCardMock.mockResolvedValue({ id: 'card-1', equipoId: 'eq' });
    await enqueueOpenCard(U, APERTURA);
    enLaPrimeraTransaccion(() => discardOp('card-1', U));

    await runOnce();

    expect(openCardMock).not.toHaveBeenCalled();
    expect(await db.outbox.count()).toBe(0);
  });
});

describe('EJEC M2 — quien espera un guardado no queda mirando un spinner por algo que no va a salir', () => {
  it('con una operación de la misma entidad ya en la cola, un fallo transitorio libera TAMBIÉN a la que quedó detrás', async () => {
    sendWriteMock.mockRejectedValue(new DomainError('Bad gateway', { status: 502 }));
    await enqueueHttpWrite(U, {
      id: 'delante', endpoint: 'item.update', params: { id: 'X' }, body: { name: 'B' }, label: 'delante',
    });
    const inicio = Date.now();

    const resultado = await submitWrite('item.update', { params: { id: 'X' }, body: { name: 'C' } }, { waitMs: 8000 });

    expect(resultado.status).toBe('queued');
    expect(Date.now() - inicio).toBeLessThan(2000);
    // La de atrás ni se intentó (misma entidad que la retenida).
    expect(sendWriteMock).toHaveBeenCalledTimes(1);
  });

  it('sin red (navigator.onLine === false) no espera nada', async () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    sendWriteMock.mockRejectedValue(SIN_SENAL());
    const inicio = Date.now();

    const resultado = await submitWrite('item.update', { params: { id: 'X' }, body: { name: 'C' } }, { waitMs: 8000 });

    expect(resultado.status).toBe('queued');
    expect(Date.now() - inicio).toBeLessThan(500);
  });
});

describe('ROB MEDIO-5 — qué errores cuentan y cuáles no', () => {
  it.each([502, 503, 504, 524, 408])('un %i no cuenta para el tope: tras 8 intentos sigue pendiente', async (status) => {
    sendWriteMock.mockRejectedValue(new DomainError('x', { status }));
    await borrarCategoria('a', 'c1');

    for (let i = 0; i < 8; i += 1) await runOnce();

    const op = await db.outbox.get('a');
    expect(op?.status).toBe('pending');
    // Un disparador de fondo puede sumar un run: lo que importa es que sigue pendiente.
    expect(op?.attempts).toBeGreaterThanOrEqual(8);
    expect(op?.serverErrors ?? 0).toBe(0);
  });

  it('500 y 501 sí cuentan: a los 5 pasa a atención', async () => {
    sendWriteMock.mockRejectedValue(new DomainError('x', { status: 500 }));
    await borrarCategoria('a', 'c1');

    for (let i = 0; i < 5; i += 1) await runOnce();

    expect((await db.outbox.get('a'))?.status).toBe('needs_attention');
  });
});

describe('ROB MEDIO-12 — las referencias a un catálogo creado sin señal encadenan', () => {
  it('si la categoría se rechaza, el ítem que la usaba queda retenido y no se manda con un id inexistente', async () => {
    sendWriteMock.mockRejectedValue(new DomainError('Ya existe', { status: 409 }));
    await enqueueHttpWrite(U, {
      id: 'cat-op', endpoint: 'category.create', params: {}, body: { id: 'cat-1', name: 'Filtros' }, label: 'Nueva categoría',
    });
    await enqueueHttpWrite(U, {
      id: 'item-op', endpoint: 'item.create', params: {},
      body: { id: 'item-1', sku: 'F', name: 'Filtro', unit: 'UNIT', type: 'PART', categoryId: 'cat-1' }, label: 'Nuevo ítem',
    });

    await runOnce();

    expect((await db.outbox.get('cat-op'))?.status).toBe('needs_attention');
    expect((await db.outbox.get('item-op'))?.attempts).toBe(0);
    expect(sendWriteMock).toHaveBeenCalledTimes(1);
  });
});

describe('EJEC BAJO / ROB MEDIO-7 — tras sincronizar, las listas se refrescan de verdad', () => {
  it('refresca también las queries que no están en pantalla (refetchType all)', async () => {
    const queryFn = vi.fn().mockResolvedValue(['viejo']);
    await queryClient.fetchQuery({ queryKey: ['inventory', 'items'], queryFn });
    expect(queryFn).toHaveBeenCalledTimes(1);
    sendWriteMock.mockResolvedValue({ id: 'X' });
    await enqueueHttpWrite(U, { id: 'e1', endpoint: 'item.update', params: { id: 'X' }, body: { name: 'B' }, label: 'e1' });

    await runOnce();

    await waitFor(() => expect(queryFn).toHaveBeenCalledTimes(2));
  });

  it('con un run que solo tuvo fallos no refresca nada', async () => {
    const queryFn = vi.fn().mockResolvedValue(['viejo']);
    await queryClient.fetchQuery({ queryKey: ['inventory', 'items'], queryFn });
    sendWriteMock.mockRejectedValue(SIN_SENAL());
    await enqueueHttpWrite(U, { id: 'e1', endpoint: 'item.update', params: { id: 'X' }, body: { name: 'B' }, label: 'e1' });

    await runOnce();
    await new Promise((resolve) => setTimeout(resolve, 30));

    expect(queryFn).toHaveBeenCalledTimes(1);
  });

  describe('cache de lecturas del Service Worker (NetworkFirst con plazo)', () => {
    function fingirCaches(urls: string[]) {
      const guardadas = new Set(urls);
      const cache = {
        keys: async () => [...guardadas].map((url) => ({ url })),
        delete: vi.fn(async (request: { url: string }) => guardadas.delete(request.url)),
      };
      vi.stubGlobal('caches', { has: async () => true, open: async () => cache, keys: async () => ['smi-api'] });
      return guardadas;
    }

    it('antes de refrescar quita de smi-api la copia vieja de lo que cambió (y solo eso)', async () => {
      const guardadas = fingirCaches([
        'https://smi.test/api/inventory/items?isActive=true',
        'https://smi.test/api/inventory/items/X',
        'https://smi.test/api/branches?isActive=true',
      ]);
      sendWriteMock.mockResolvedValue({ id: 'X' });
      await enqueueHttpWrite(U, { id: 'e1', endpoint: 'item.update', params: { id: 'X' }, body: { name: 'B' }, label: 'e1' });

      await runOnce();

      expect([...guardadas]).toEqual(['https://smi.test/api/branches?isActive=true']);
    });

    it('sin red no toca el cache: dejaría las pantallas sin lecturas para el arranque sin señal', async () => {
      const guardadas = fingirCaches(['https://smi.test/api/inventory/items?isActive=true']);
      sendWriteMock.mockResolvedValueOnce({ id: 'X' }).mockImplementation(async () => {
        vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
        throw SIN_SENAL();
      });
      await enqueueHttpWrite(U, { id: 'e1', endpoint: 'item.update', params: { id: 'X' }, body: { name: 'B' }, label: 'e1' });
      await enqueueHttpWrite(U, { id: 'e2', endpoint: 'branch.delete', params: { id: 'b' }, body: {}, label: 'e2' });

      await runOnce();

      expect(guardadas.size).toBe(1);
    });
  });
});

describe('ROB MEDIO-9 — varias pestañas', () => {
  it('el resultado de una operación que se resolvió en OTRA pestaña llega a quien la espera en esta', async () => {
    const otraPestana = new BroadcastChannel('smi-outbox');
    const espera = waitForOutcome('op-remota', 5000);

    otraPestana.postMessage({
      type: 'outcome',
      opId: 'op-remota',
      outcome: { kind: 'business', message: 'Ya existe una sucursal con ese nombre', code: 'X', status: 409 },
    });

    await expect(espera.promise).resolves.toMatchObject({
      kind: 'business',
      error: { message: 'Ya existe una sucursal con ese nombre', code: 'X', status: 409 },
    });
    otraPestana.close();
  });

  it('esta pestaña le cuenta a las otras cómo terminó lo que nadie espera acá', async () => {
    const otraPestana = new BroadcastChannel('smi-outbox');
    const recibidos: unknown[] = [];
    otraPestana.onmessage = (evento: MessageEvent<unknown>) => recibidos.push(evento.data);
    sendWriteMock.mockResolvedValue(true);
    waitForOutcome('cualquiera', 1); // abre el canal de esta pestaña
    await borrarCategoria('a', 'c1');

    await runOnce();

    await waitFor(() =>
      expect(recibidos).toContainEqual({ type: 'outcome', opId: 'a', outcome: { kind: 'sent', data: true } }),
    );
    otraPestana.close();
  });

  it('un aviso de otra pestaña que no pudo sincronizar hace que esta, que tiene el candado, corra otra vez', async () => {
    const otraPestana = new BroadcastChannel('smi-outbox');
    // El run de esta pestaña ya pasó su última lectura de la cola y sigue con el candado:
    // lo detiene la limpieza del cache del Service Worker, que acá controla la prueba.
    let bloqueado = false;
    let liberar: () => void = () => undefined;
    vi.stubGlobal('caches', {
      has: () => {
        if (bloqueado) return Promise.resolve(false); // solo el primer run se detiene
        bloqueado = true;
        return new Promise<boolean>((resolve) => {
          liberar = () => resolve(false);
        });
      },
    });
    sendWriteMock.mockResolvedValue(true);
    await borrarCategoria('a', 'c1');
    requestSync();
    await waitFor(() => expect(bloqueado).toBe(true));
    // Una operación que ningún disparador de ESTA pestaña pidió enviar (entró por otra).
    const ahora = Date.now() + 1000;
    await db.outbox.put({
      id: 'b', type: 'httpWrite', v: 1, userId: U, endpoint: 'category.delete', params: { id: 'c2' }, body: {},
      label: 'b', status: 'pending', attempts: 0, seq: ahora, createdAt: ahora, updatedAt: ahora,
    } as OutboxOp);

    otraPestana.postMessage({ type: 'sync-requested' });
    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(sendWriteMock).toHaveBeenCalledTimes(1);
    liberar();

    await waitFor(() => expect(sendWriteMock).toHaveBeenCalledTimes(2));
    otraPestana.close();
  });
});
