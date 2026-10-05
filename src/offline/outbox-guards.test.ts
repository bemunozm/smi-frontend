import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { requestSyncMock } = vi.hoisted(() => ({ requestSyncMock: vi.fn() }));
vi.mock('./replay', () => ({ requestSync: requestSyncMock, getCurrentUserId: () => 'u1' }));

import { db } from './db';
import { ENDPOINTS } from './endpoints';
import {
  discardOp,
  enqueueCloseCard,
  enqueueCreateHallazgo,
  enqueueExitReport,
  enqueueHttpWrite,
  enqueueOpenCard,
  overwriteOp,
} from './outbox';
import type { CreateHallazgoInput } from '../types/hallazgos';
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

const HALLAZGO_INPUT: CreateHallazgoInput = {
  id: 'h-1',
  equipoId: 'eq-1',
  descripcion: 'Fuga de aceite',
  prioridad: 'ALTA',
  capturedAt: '2026-09-24T09:00:00.000Z',
} as CreateHallazgoInput;

function archivo(bytes: number, type = 'image/jpeg'): File {
  return new File([new Uint8Array(bytes)], 'foto.jpg', { type });
}

beforeEach(async () => {
  await db.outbox.clear();
  await db.blobs.clear();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('foto o archivo que el servidor rechazaría: se rechaza AL GUARDAR, no horas después', () => {
  const CIERRE = { closeClientId: 'close-1', valorFinal: 130, fuelLiters: 20, capturedAt: '2026-09-24T16:00:00.000Z' };

  it('un cierre con una foto de más de 8 MB (la compresión no pudo achicarla) no se guarda', async () => {
    await expect(enqueueCloseCard('u1', 'card-1', CIERRE, archivo(9 * 1024 * 1024))).rejects.toMatchObject({
      name: 'DomainError',
      code: 'FILE_TOO_LARGE',
    });

    expect(await db.outbox.count()).toBe(0);
    expect(await db.blobs.count()).toBe(0);
    expect(requestSyncMock).not.toHaveBeenCalled();
  });

  it('un cierre con un formato que el servidor no acepta (HEIC) no se guarda', async () => {
    await expect(enqueueCloseCard('u1', 'card-1', CIERRE, archivo(1024, 'image/heic'))).rejects.toMatchObject({
      code: 'FILE_TYPE_NOT_ALLOWED',
    });

    expect(await db.outbox.count()).toBe(0);
    expect(await db.blobs.count()).toBe(0);
  });

  it('un hallazgo con una foto inválida tampoco se guarda', async () => {
    await expect(enqueueCreateHallazgo('u1', HALLAZGO_INPUT, archivo(9 * 1024 * 1024))).rejects.toMatchObject({
      code: 'FILE_TOO_LARGE',
    });
    await expect(enqueueCreateHallazgo('u1', HALLAZGO_INPUT, archivo(10, 'image/heic'))).rejects.toMatchObject({
      code: 'FILE_TYPE_NOT_ALLOWED',
    });

    expect(await db.outbox.count()).toBe(0);
    expect(await db.blobs.count()).toBe(0);
  });

  it('una foto válida (PNG) pasa', async () => {
    await enqueueCreateHallazgo('u1', HALLAZGO_INPUT, archivo(1024, 'image/png'));

    expect((await db.outbox.get('h-1'))?.status).toBe('pending_upload');
  });
});

describe('enqueueExitReport — espera a las tarjetas que siguen en la cola', () => {
  const REPORTE = {
    id: 'rep-1',
    shiftDate: '2026-09-24',
    shiftType: 'DIURNO' as const,
    cardIds: ['card-1', 'card-2'],
    requestedAt: '2026-09-24T20:00:00.000Z',
  };
  const CIERRE_1 = { closeClientId: 'close-1', valorFinal: 130, fuelLiters: 20, capturedAt: '2026-09-24T16:00:00.000Z' };

  it('depende de la apertura y del cierre pendientes de sus tarjetas, no de lo ajeno', async () => {
    await enqueueOpenCard('u1', OPEN_INPUT);
    await enqueueCloseCard('u1', 'card-1', CIERRE_1, archivo(1024));
    await enqueueOpenCard('u1', { ...OPEN_INPUT, id: 'otra-tarjeta' });

    await enqueueExitReport('u1', REPORTE);

    const reporte = await db.outbox.get('rep-1');
    expect(reporte?.dependsOn?.slice().sort()).toEqual(['card-1', 'close-1']);
  });

  it('sin nada de sus tarjetas en la cola no declara dependencias', async () => {
    await enqueueExitReport('u1', REPORTE);

    expect((await db.outbox.get('rep-1'))?.dependsOn).toBeUndefined();
  });

  it('descartar el cierre de UNA tarjeta no se lleva el reporte de todas: sigue, sin esa dependencia', async () => {
    await enqueueOpenCard('u1', OPEN_INPUT);
    await enqueueCloseCard('u1', 'card-1', CIERRE_1, archivo(1024));
    await enqueueExitReport('u1', REPORTE);

    await discardOp('card-1', 'u1');

    expect(await db.outbox.get('card-1')).toBeUndefined();
    expect(await db.outbox.get('close-1')).toBeUndefined();
    const reporte = await db.outbox.get('rep-1');
    expect(reporte).toBeTruthy();
    expect(reporte?.dependsOn).toBeUndefined();
  });
});

describe('discardOp — no descarta lo que está en vuelo', () => {
  it('una operación en `syncing` se deja: el servidor puede estar aplicándola ahora', async () => {
    await enqueueOpenCard('u1', OPEN_INPUT);
    const op = await db.outbox.get('card-1');
    if (!op) throw new Error('setup inválido');
    await db.outbox.put({ ...op, status: 'syncing' });

    await discardOp('card-1', 'u1');

    expect(await db.outbox.get('card-1')).toBeTruthy();
  });

  it('cualquier otro estado sí se puede descartar, aunque nunca haya pasado a needs_attention', async () => {
    await enqueueOpenCard('u1', OPEN_INPUT);
    const op = await db.outbox.get('card-1');
    if (!op) throw new Error('setup inválido');
    await db.outbox.put({ ...op, status: 'pending', attempts: 9, lastError: { message: 'Sin señal' } });

    await discardOp('card-1', 'u1');

    expect(await db.outbox.get('card-1')).toBeUndefined();
  });
});

describe('overwriteOp — Sobrescribir quita TODA la precondición', () => {
  it('un conteo físico: además del header, quita expectedQuantity del body', async () => {
    const op = await enqueueHttpWrite('u1', {
      id: 'conteo-1',
      endpoint: 'item.adjust',
      params: { id: 'item-1' },
      body: { id: 'conteo-1', branchId: 'br-1', countedQuantity: 17, expectedQuantity: 19, notes: 'conteo' },
      label: 'Conteo físico',
    });
    await db.outbox.put({
      ...op,
      status: 'needs_attention',
      lastError: { code: 'STALE_UPDATE', status: 409, message: 'x' },
    });

    await overwriteOp('conteo-1', 'u1');

    const reenviada = await db.outbox.get('conteo-1');
    if (reenviada?.type !== 'httpWrite') throw new Error('setup inválido');
    expect(reenviada.body).toEqual({ id: 'conteo-1', branchId: 'br-1', countedQuantity: 17, notes: 'conteo' });
    expect(reenviada.status).toBe('pending');
    expect(reenviada.lastError).toBeUndefined();
  });

  it('una edición con X-Expected: quita el header y deja el body como estaba', async () => {
    const op = await enqueueHttpWrite('u1', {
      id: 'edicion-1',
      endpoint: 'item.update',
      params: { id: 'item-1' },
      body: { name: 'Aceite' },
      expected: { name: 'Aceite viejo' },
      label: 'Edición de ítem',
    });
    await db.outbox.put({ ...op, status: 'needs_attention' });

    await overwriteOp('edicion-1', 'u1');

    const reenviada = await db.outbox.get('edicion-1');
    if (reenviada?.type !== 'httpWrite') throw new Error('setup inválido');
    expect(reenviada.expected).toBeUndefined();
    expect(reenviada.body).toEqual({ name: 'Aceite' });
  });
});

describe('referencias a catálogos: lo que usa una creación pendiente va detrás de ella', () => {
  const ITEM = { id: 'item-1', sku: 'F-1', name: 'Filtro', unit: 'UNIT', type: 'PART', categoryId: 'cat-1' } as const;

  async function crearCategoria() {
    await enqueueHttpWrite('u1', {
      id: 'cat-op',
      endpoint: 'category.create',
      params: {},
      body: { id: 'cat-1', name: 'Filtros' },
      label: 'Nueva categoría',
    });
  }

  it('un ítem que usa una categoría creada sin señal depende de esa creación', async () => {
    await crearCategoria();

    const item = await enqueueHttpWrite('u1', {
      id: 'item-op',
      endpoint: 'item.create',
      params: {},
      body: ITEM,
      label: 'Nuevo ítem',
    });

    expect(item.dependsOn).toEqual(['cat-op']);
  });

  it('un ítem cuya categoría ya existe en el servidor no depende de nada', async () => {
    const item = await enqueueHttpWrite('u1', {
      id: 'item-op',
      endpoint: 'item.create',
      params: {},
      body: { ...ITEM, categoryId: 'cat-ya-existe' },
      label: 'Nuevo ítem',
    });

    expect(item.dependsOn).toBeUndefined();
  });

  it('descartar la creación de la categoría se lleva al ítem que la usaba', async () => {
    await crearCategoria();
    await enqueueHttpWrite('u1', {
      id: 'item-op',
      endpoint: 'item.create',
      params: {},
      body: ITEM,
      label: 'Nuevo ítem',
    });

    await discardOp('cat-op', 'u1');

    expect(await db.outbox.count()).toBe(0);
  });

  it.each([
    ['stock.transfer', { id: 't', itemId: 'i', sourceBranchId: 'b1', destinationBranchId: 'b2', quantity: 1 }, ['branch:b1', 'branch:b2']],
    ['movement.create', { id: 'm', itemId: 'i', branchId: 'b1', equipmentId: 'e1' }, ['branch:b1', 'equipment:e1']],
    ['item.adjust', { id: 'a', branchId: 'b1', countedQuantity: 1 }, ['branch:b1']],
    ['item.setMinimum', { itemId: 'i', branchId: 'b1', minimumQuantity: 1 }, ['branch:b1']],
    ['equipment.assign', { operatorId: 'o1' }, ['operator:o1']],
    ['equipment.update', { homeBranchId: 'b1' }, ['branch:b1']],
    ['horometro.create', { id: 'h', equipoId: 'e1', operatorId: 'o1' }, ['equipment:e1', 'operator:o1']],
    ['combustible.create', { id: 'c', equipoId: 'e1' }, ['equipment:e1']],
    ['orden.create', { id: 'ot', equipoId: 'e1' }, ['equipment:e1']],
    ['actividad.create', { id: 'ac', equipoId: 'e1', hallazgoId: 'hz1' }, ['equipment:e1', 'hallazgo:hz1']],
  ] as const)('%s declara las entidades que referencia', (endpoint, body, esperado) => {
    expect(ENDPOINTS[endpoint].parents?.({ id: 'x' }, body)).toEqual(esperado);
  });
});
