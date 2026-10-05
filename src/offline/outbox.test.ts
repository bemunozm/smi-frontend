import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { requestSyncMock } = vi.hoisted(() => ({ requestSyncMock: vi.fn() }));
vi.mock('./replay', () => ({ requestSync: requestSyncMock }));

import { db } from './db';
import {
  countPending,
  discardOp,
  enqueueCloseCard,
  enqueueCreateHallazgo,
  enqueueCreateTrabajoExtra,
  enqueueExitReport,
  enqueueOpenCard,
  retryOp,
} from './outbox';
import type { CreateHallazgoInput } from '../types/hallazgos';
import type { CreateTrabajoExtraInput } from '../types/trabajosExtra';
import type { OpenShiftCardInput } from '../types/shift';

const OPEN_INPUT: OpenShiftCardInput = {
  id: 'card-1',
  equipoId: 'eq-1',
  operatorId: 'op-1',
  valorInicial: 100,
  shiftDate: '2026-09-24',
  shiftType: 'DIURNO',
  capturedAt: '2026-09-24T09:00:00.000Z',
};

function photoFile(): File {
  return new File([new Uint8Array([1, 2, 3])], 'surtidor.jpg', { type: 'image/jpeg' });
}

beforeEach(async () => {
  await db.outbox.clear();
  await db.photos.clear();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('enqueueOpenCard', () => {
  it('guarda una operación pending con el id del cliente y dispara requestSync', async () => {
    await enqueueOpenCard('u1', OPEN_INPUT);

    const op = await db.outbox.get('card-1');
    expect(op).toMatchObject({ id: 'card-1', type: 'openCard', userId: 'u1', status: 'pending', payload: OPEN_INPUT });
    expect(requestSyncMock).toHaveBeenCalledTimes(1);
  });
});

describe('enqueueCloseCard', () => {
  it('guarda la foto y la operación en pending_upload en UNA transacción', async () => {
    await enqueueCloseCard(
      'u1',
      'card-1',
      {
        closeClientId: 'close-1',
        valorFinal: 130,
        fuelLiters: 20,
        capturedAt: '2026-09-24T16:00:00.000Z',
      },
      photoFile(),
    );

    const op = await db.outbox.get('close-1');
    expect(op).toMatchObject({
      id: 'close-1',
      type: 'closeCard',
      status: 'pending_upload',
      photoId: 'close-1',
      payload: { cardId: 'card-1', input: { closeClientId: 'close-1', valorFinal: 130, fuelLiters: 20 } },
    });
    if (op?.type !== 'closeCard') throw new Error('setup inválido');
    // `tmpPhotoKey` NO viaja en el payload guardado — todavía no existe.
    expect('tmpPhotoKey' in op.payload.input).toBe(false);

    const photo = await db.photos.get('close-1');
    expect(photo).toBeTruthy();
    expect(photo!.mime).toBe('image/jpeg');
    expect(requestSyncMock).toHaveBeenCalledTimes(1);
  });

  it('atomicidad: la foto y la operación aparecen juntas (mismo id)', async () => {
    await enqueueCloseCard(
      'u1',
      'card-2',
      { closeClientId: 'close-2', valorFinal: 50, fuelLiters: 0, capturedAt: '2026-09-24T16:00:00.000Z' },
      photoFile(),
    );

    const [op, photo] = await Promise.all([db.outbox.get('close-2'), db.photos.get('close-2')]);
    expect(op).toBeTruthy();
    expect(photo).toBeTruthy();
  });
});

describe('enqueueExitReport', () => {
  it('guarda una operación pending con el id del reporte', async () => {
    await enqueueExitReport('u1', {
      id: 'report-1',
      shiftDate: '2026-09-24',
      shiftType: 'DIURNO',
      cardIds: ['card-1', 'card-2'],
      requestedAt: '2026-09-24T20:00:00.000Z',
    });

    const op = await db.outbox.get('report-1');
    expect(op).toMatchObject({ id: 'report-1', type: 'sendExitReport', status: 'pending' });
    expect(requestSyncMock).toHaveBeenCalledTimes(1);
  });
});

describe('discardOp', () => {
  it('borra la operación Y su foto (cierre)', async () => {
    await enqueueCloseCard(
      'u1',
      'card-3',
      { closeClientId: 'close-3', valorFinal: 10, fuelLiters: 0, capturedAt: '2026-09-24T16:00:00.000Z' },
      photoFile(),
    );

    await discardOp('close-3', 'u1');

    expect(await db.outbox.get('close-3')).toBeUndefined();
    expect(await db.photos.get('close-3')).toBeUndefined();
  });

  it('sin foto (apertura), solo borra la operación', async () => {
    await enqueueOpenCard('u1', OPEN_INPUT);

    await discardOp('card-1', 'u1');

    expect(await db.outbox.get('card-1')).toBeUndefined();
  });

  it('una operación inexistente no lanza', async () => {
    await expect(discardOp('no-existe', 'u1')).resolves.toBeUndefined();
  });

  it('defensa en profundidad: un userId que no calza con el dueño de la operación no hace nada', async () => {
    await enqueueOpenCard('u1', OPEN_INPUT);

    await discardOp('card-1', 'u2');

    expect(await db.outbox.get('card-1')).toBeTruthy();
  });

  // "Un cierre cuya apertura falló": descartar la apertura
  // arrastra su cierre dependiente (misma `cardId`), porque sin la apertura
  // esa tarjeta nunca va a existir en el servidor.
  describe('cascada apertura → cierre dependiente', () => {
    it('descartar un openCard borra también el closeCard que depende de esa cardId, y su foto', async () => {
      await enqueueOpenCard('u1', OPEN_INPUT); // id 'card-1'
      await enqueueCloseCard(
        'u1',
        'card-1',
        { closeClientId: 'close-1', valorFinal: 130, fuelLiters: 20, capturedAt: '2026-09-24T16:00:00.000Z' },
        photoFile(),
      );

      await discardOp('card-1', 'u1');

      expect(await db.outbox.get('card-1')).toBeUndefined();
      expect(await db.outbox.get('close-1')).toBeUndefined();
      expect(await db.photos.get('close-1')).toBeUndefined();
    });

    it('no toca un closeCard de OTRA cardId', async () => {
      await enqueueOpenCard('u1', OPEN_INPUT); // id 'card-1'
      await enqueueCloseCard(
        'u1',
        'card-otra',
        { closeClientId: 'close-ajeno', valorFinal: 10, fuelLiters: 0, capturedAt: '2026-09-24T16:00:00.000Z' },
        photoFile(),
      );

      await discardOp('card-1', 'u1');

      expect(await db.outbox.get('close-ajeno')).toBeTruthy();
      expect(await db.photos.get('close-ajeno')).toBeTruthy();
    });

    it('descartar un closeCard (no una apertura) no toca ninguna otra operación', async () => {
      await enqueueOpenCard('u1', OPEN_INPUT); // id 'card-1'
      await enqueueCloseCard(
        'u1',
        'card-1',
        { closeClientId: 'close-1', valorFinal: 130, fuelLiters: 20, capturedAt: '2026-09-24T16:00:00.000Z' },
        photoFile(),
      );

      await discardOp('close-1', 'u1');

      expect(await db.outbox.get('card-1')).toBeTruthy();
      expect(await db.outbox.get('close-1')).toBeUndefined();
    });
  });
});

describe('retryOp', () => {
  it('una apertura needs_attention vuelve a pending y limpia lastError', async () => {
    await enqueueOpenCard('u1', OPEN_INPUT);
    await db.outbox.put({
      id: 'card-1',
      type: 'openCard',
      v: 1,
      userId: 'u1',
      payload: OPEN_INPUT,
      status: 'needs_attention',
      attempts: 1,
      lastError: { message: 'boom' },
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    await retryOp('card-1', 'u1');

    const op = await db.outbox.get('card-1');
    expect(op?.status).toBe('pending');
    expect(op?.lastError).toBeUndefined();
  });

  it('un cierre needs_attention CON tmpKey ya subida vuelve a pending_claim (no a pending_upload)', async () => {
    await enqueueCloseCard(
      'u1',
      'card-4',
      { closeClientId: 'close-4', valorFinal: 10, fuelLiters: 0, capturedAt: '2026-09-24T16:00:00.000Z' },
      photoFile(),
    );
    const op = await db.outbox.get('close-4');
    if (op?.type !== 'closeCard') throw new Error('setup inválido');
    await db.outbox.put({ ...op, status: 'needs_attention', tmpKey: 'tmp/u1/x.jpg' });

    await retryOp('close-4', 'u1');

    expect((await db.outbox.get('close-4'))?.status).toBe('pending_claim');
  });

  it('defensa en profundidad: un userId que no calza con el dueño de la operación no hace nada', async () => {
    await enqueueOpenCard('u1', OPEN_INPUT);
    await db.outbox.put({
      id: 'card-1',
      type: 'openCard',
      v: 1,
      userId: 'u1',
      payload: OPEN_INPUT,
      status: 'needs_attention',
      attempts: 1,
      lastError: { message: 'boom' },
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    await retryOp('card-1', 'u2');

    expect((await db.outbox.get('card-1'))?.status).toBe('needs_attention');
  });
});

describe('countPending', () => {
  it('cuenta todas las operaciones del usuario, en cualquier estado', async () => {
    await enqueueOpenCard('u1', OPEN_INPUT);
    await enqueueExitReport('u1', {
      id: 'report-9',
      shiftDate: '2026-09-24',
      shiftType: 'DIURNO',
      cardIds: ['card-1'],
      requestedAt: '2026-09-24T20:00:00.000Z',
    });

    expect(await countPending('u1')).toBe(2);
  });

  it('aísla por usuario: no cuenta operaciones de otro userId', async () => {
    await enqueueOpenCard('u1', OPEN_INPUT);
    await enqueueOpenCard('u2', { ...OPEN_INPUT, id: 'card-otro-usuario' });

    expect(await countPending('u1')).toBe(1);
    expect(await countPending('u2')).toBe(1);
  });

  it('sin operaciones, devuelve 0', async () => {
    expect(await countPending('nadie')).toBe(0);
  });
});

const HALLAZGO_INPUT: CreateHallazgoInput = {
  id: 'h-1',
  equipoId: 'eq-1',
  descripcion: 'Fuga de aceite',
  prioridad: 'ALTA',
  capturedAt: '2026-09-24T09:00:00.000Z',
};

const TRABAJO_INPUT: CreateTrabajoExtraInput = {
  id: 't-1',
  equipoId: 'eq-1',
  operatorId: 'op-1',
  faena: 'Patillo',
  turno: 'DIURNO',
  horometroInicial: 100,
  horometroFinal: 112,
  actividades: ['SOLTAR_MATERIAL'],
  descripcion: 'Carga extra',
  capturedAt: '2026-09-24T09:00:00.000Z',
};

describe('enqueueCreateHallazgo', () => {
  it('con foto: guarda foto y operación pending_upload en UNA transacción, con el id del cliente', async () => {
    await enqueueCreateHallazgo('u1', HALLAZGO_INPUT, photoFile());

    const op = await db.outbox.get('h-1');
    expect(op).toMatchObject({
      id: 'h-1',
      type: 'createHallazgo',
      userId: 'u1',
      status: 'pending_upload',
      photoId: 'h-1',
      payload: HALLAZGO_INPUT,
    });
    // `fotoKey` no existe todavía: se arma recién al subir la foto en el replay.
    if (op?.type !== 'createHallazgo') throw new Error('setup inválido');
    expect('fotoKey' in op.payload).toBe(false);
    expect(await db.photos.get('h-1')).toBeTruthy();
    expect(requestSyncMock).toHaveBeenCalledTimes(1);
  });

  it('sin foto: guarda solo la operación en pending, sin fila de photos ni photoId', async () => {
    await enqueueCreateHallazgo('u1', HALLAZGO_INPUT);

    const op = await db.outbox.get('h-1');
    expect(op?.status).toBe('pending');
    expect(op && 'photoId' in op ? op.photoId : undefined).toBeUndefined();
    expect(await db.photos.count()).toBe(0);
    expect(requestSyncMock).toHaveBeenCalledTimes(1);
  });
});

describe('enqueueCreateTrabajoExtra', () => {
  it('guarda una operación pending con el id del cliente y dispara requestSync', async () => {
    await enqueueCreateTrabajoExtra('u1', TRABAJO_INPUT);

    const op = await db.outbox.get('t-1');
    expect(op).toMatchObject({
      id: 't-1',
      type: 'createTrabajoExtra',
      userId: 'u1',
      status: 'pending',
      payload: TRABAJO_INPUT,
    });
    expect(requestSyncMock).toHaveBeenCalledTimes(1);
  });
});

describe('discardOp / retryOp — hallazgo y trabajo extra', () => {
  it('descartar un hallazgo con foto borra también la foto', async () => {
    await enqueueCreateHallazgo('u1', HALLAZGO_INPUT, photoFile());

    await discardOp('h-1', 'u1');

    expect(await db.outbox.get('h-1')).toBeUndefined();
    expect(await db.photos.get('h-1')).toBeUndefined();
  });

  it('descartar un hallazgo sin foto o un trabajo extra solo borra la operación', async () => {
    await enqueueCreateHallazgo('u1', HALLAZGO_INPUT);
    await enqueueCreateTrabajoExtra('u1', TRABAJO_INPUT);

    await discardOp('h-1', 'u1');
    await discardOp('t-1', 'u1');

    expect(await countPending('u1')).toBe(0);
  });

  it('un hallazgo CON foto en needs_attention vuelve a pending_upload; con tmpKey, a pending_claim', async () => {
    await enqueueCreateHallazgo('u1', HALLAZGO_INPUT, photoFile());
    const op = await db.outbox.get('h-1');
    if (op?.type !== 'createHallazgo') throw new Error('setup inválido');

    await db.outbox.put({ ...op, status: 'needs_attention', lastError: { message: 'x' } });
    await retryOp('h-1', 'u1');
    expect((await db.outbox.get('h-1'))?.status).toBe('pending_upload');

    await db.outbox.put({ ...op, status: 'needs_attention', tmpKey: 'tmp/u1/x.jpg' });
    await retryOp('h-1', 'u1');
    expect((await db.outbox.get('h-1'))?.status).toBe('pending_claim');
  });

  it('un hallazgo SIN foto o un trabajo extra en needs_attention vuelven a pending', async () => {
    await enqueueCreateHallazgo('u1', HALLAZGO_INPUT);
    await enqueueCreateTrabajoExtra('u1', TRABAJO_INPUT);
    for (const id of ['h-1', 't-1']) {
      const op = await db.outbox.get(id);
      if (!op) throw new Error('setup inválido');
      await db.outbox.put({ ...op, status: 'needs_attention', lastError: { message: 'x' } });
      await retryOp(id, 'u1');
      const retried = await db.outbox.get(id);
      expect(retried?.status).toBe('pending');
      expect(retried?.lastError).toBeUndefined();
    }
  });
});
