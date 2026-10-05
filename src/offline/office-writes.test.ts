import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { waitFor } from '@testing-library/react';

const { sendWriteMock, uploadFileMock } = vi.hoisted(() => ({
  sendWriteMock: vi.fn(),
  uploadFileMock: vi.fn(),
}));

vi.mock('../api/ShiftCardAPI', () => ({
  ShiftCardAPI: { openCard: vi.fn(), closeCard: vi.fn(), listMine: vi.fn() },
}));
vi.mock('../api/WriteAPI', () => ({ sendWrite: sendWriteMock }));
vi.mock('../api/UploadsAPI', () => ({ uploadFile: uploadFileMock }));

import { db, equipmentEntity, opsDeCreacion, type HttpWriteOp } from './db';
import { ENDPOINTS, RUTAS_QUE_NUNCA_SE_ENCOLAN, isEndpointKey, type EndpointKey } from './endpoints';
import { cambiosPendientes, discardOp, enqueueHttpWrite, escriturasPendientes } from './outbox';
import { requestSync, resetReplayEngineForTests, setCurrentUser, useEngineStoreForTests } from './replay';
import { submitWrite } from './submit-write';
import { DomainError } from '../lib/api-error';
import { queryClient } from '../lib/query-client';

const ID_EQUIPO = '11111111-1111-4111-8111-111111111111';
const EQUIPO_BODY = {
  id: ID_EQUIPO,
  internalCode: 'EX-001',
  equipmentClass: 'HEAVY' as const,
  type: 'Excavadora',
  brand: 'Caterpillar',
  model: '336',
  controlUnit: 'HOURS' as const,
  status: 'OPERATIONAL' as const,
};

async function syncAndSettle(userId = 'u1') {
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

describe('registro de endpoints: una entrada por escritura de oficina', () => {
  const CREATES: EndpointKey[] = [
    'equipment.create',
    'equipmentDocument.create',
    'horometro.create',
    'combustible.create',
    'item.create',
    'category.create',
    'branch.create',
    'operator.create',
    'orden.create',
    'intervencion.create',
    'actividad.create',
    'umbral.create',
  ];

  it('toda entrada que crea declara `creates` y la entidad que crea (a partir del id del body)', () => {
    for (const key of CREATES) {
      const def = ENDPOINTS[key];
      expect(def.creates, key).toBe(true);
      expect(def.entity?.({}, { id: 'abc' }), key).toMatch(/:abc$/);
    }
  });

  it('solo las creaciones declaran `creates`', () => {
    const declaran = (Object.keys(ENDPOINTS) as EndpointKey[]).filter((key) => ENDPOINTS[key].creates);
    expect(declaran.sort()).toEqual([...CREATES].sort());
  });

  it('ninguna entrada del registro apunta a una ruta que NUNCA se encola, ni usa GET', () => {
    // Un `params` que devuelve algo para cualquier nombre: arma el path de cualquier entrada.
    const params = new Proxy({}, { get: () => 'x' }) as Record<string, string>;
    for (const key of Object.keys(ENDPOINTS) as EndpointKey[]) {
      const def = ENDPOINTS[key];
      const ruta = def.path(params);
      for (const prohibida of RUTAS_QUE_NUNCA_SE_ENCOLAN) {
        expect(ruta.startsWith(prohibida), `${key} → ${ruta}`).toBe(false);
      }
      expect(['POST', 'PATCH', 'PUT', 'DELETE'], key).toContain(def.method);
    }
  });

  it('la lista de lo que nunca se encola cubre auth, usuarios, OCR, archivos sueltos y notificaciones', () => {
    expect([...RUTAS_QUE_NUNCA_SE_ENCOLAN]).toEqual([
      '/api/auth',
      '/api/users',
      '/api/ocr',
      '/api/files',
      '/api/notifications',
    ]);
  });

  it('los DELETE tratan el 404 de un reintento como "ya hecho"; el resto, no', () => {
    for (const key of Object.keys(ENDPOINTS) as EndpointKey[]) {
      expect(ENDPOINTS[key].notFoundIsDone, key).toBe(ENDPOINTS[key].method === 'DELETE');
    }
  });

  it('solo llevan archivos los endpoints cuyo formulario sube uno', () => {
    const conArchivos = (Object.keys(ENDPOINTS) as EndpointKey[]).filter((key) => ENDPOINTS[key].carriesFiles);
    expect(conArchivos.sort()).toEqual(
      ['combustible.create', 'equipment.create', 'equipment.update', 'equipmentDocument.create', 'equipmentDocument.update'].sort(),
    );
  });

  it('reconoce sus claves y descarta las que no conoce', () => {
    expect(isEndpointKey('equipment.create')).toBe(true);
    expect(isEndpointKey('shiftCard.edit')).toBe(true);
    expect(isEndpointKey('algo.que.no.existe')).toBe(false);
  });
});

describe('encolar: las dependencias de creación salen solas', () => {
  const crearEquipo = () =>
    enqueueHttpWrite('u1', {
      id: 'op-crear',
      endpoint: 'equipment.create',
      params: {},
      body: EQUIPO_BODY,
      label: 'Nuevo equipo',
    });

  it('una creación se guarda marcada, con su entidad y sin dependencias', async () => {
    const op = await crearEquipo();

    expect(op).toMatchObject({ creates: true, entityKey: equipmentEntity(ID_EQUIPO) });
    expect(op.dependsOn).toBeUndefined();
  });

  it('lo que se encola sobre un equipo cuya creación sigue en la cola va detrás de ella', async () => {
    await crearEquipo();

    const asignar = await enqueueHttpWrite('u1', {
      id: 'op-asignar',
      endpoint: 'equipment.assign',
      params: { id: ID_EQUIPO },
      body: { operatorId: 'op_1' },
      label: 'Asignación',
    });
    const estado = await enqueueHttpWrite('u1', {
      id: 'op-estado',
      endpoint: 'equipment.status',
      params: { id: ID_EQUIPO },
      body: { status: 'IN_WORKSHOP' },
      label: 'Estado',
    });
    const otro = await enqueueHttpWrite('u1', {
      id: 'op-otro',
      endpoint: 'equipment.status',
      params: { id: 'otro-equipo' },
      body: { status: 'IN_WORKSHOP' },
      label: 'Estado',
    });

    expect(asignar.dependsOn).toEqual(['op-crear']);
    expect(estado.dependsOn).toEqual(['op-crear']);
    expect(otro.dependsOn).toBeUndefined();
  });

  it('una edición pendiente NO es una creación: lo que viene después no depende de ella', async () => {
    await enqueueHttpWrite('u1', {
      id: 'op-edicion',
      endpoint: 'equipment.update',
      params: { id: ID_EQUIPO },
      body: { type: 'Retro' },
      label: 'Edición',
    });

    const siguiente = await enqueueHttpWrite('u1', {
      id: 'op-estado',
      endpoint: 'equipment.status',
      params: { id: ID_EQUIPO },
      body: { status: 'IN_WORKSHOP' },
      label: 'Estado',
    });

    expect(siguiente.dependsOn).toBeUndefined();
    expect(siguiente.entityKey).toBe(equipmentEntity(ID_EQUIPO));
  });

  it('un documento (sub-recurso) va detrás de la creación de SU equipo', async () => {
    await crearEquipo();

    const documento = await enqueueHttpWrite('u1', {
      id: 'op-doc',
      endpoint: 'equipmentDocument.create',
      params: { equipmentId: ID_EQUIPO },
      body: { id: 'doc-1', type: 'INSURANCE' },
      label: 'Documento',
    });

    expect(documento.dependsOn).toEqual(['op-crear']);
    expect(documento.entityKey).toBe('equipment-document:doc-1');
  });

  it('las dependencias explícitas se suman (sin duplicar) a las automáticas', async () => {
    await crearEquipo();

    const asignar = await enqueueHttpWrite('u1', {
      id: 'op-asignar',
      endpoint: 'equipment.assign',
      params: { id: ID_EQUIPO },
      body: { operatorId: 'op_1' },
      dependsOn: ['op-crear', 'otra'],
      label: 'Asignación',
    });

    expect(asignar.dependsOn?.sort()).toEqual(['op-crear', 'otra']);
  });

  it('solo mira las operaciones del mismo usuario', async () => {
    await crearEquipo();

    const ajena = await enqueueHttpWrite('u2', {
      id: 'op-ajena',
      endpoint: 'equipment.status',
      params: { id: ID_EQUIPO },
      body: { status: 'IN_WORKSHOP' },
      label: 'Estado',
    });

    expect(ajena.dependsOn).toBeUndefined();
  });

  it('descartar la creación arrastra lo que depende de ella', async () => {
    await crearEquipo();
    await enqueueHttpWrite('u1', {
      id: 'op-asignar',
      endpoint: 'equipment.assign',
      params: { id: ID_EQUIPO },
      body: { operatorId: 'op_1' },
      label: 'Asignación',
    });

    await discardOp('op-crear', 'u1');

    expect(await db.outbox.count()).toBe(0);
  });

  it('opsDeCreacion cuenta una httpWrite solo si su endpoint crea', async () => {
    await crearEquipo();
    await enqueueHttpWrite('u1', {
      id: 'op-estado',
      endpoint: 'equipment.status',
      params: { id: ID_EQUIPO },
      body: { status: 'IN_WORKSHOP' },
      label: 'Estado',
    });

    const ops = await db.outbox.toArray();

    expect(opsDeCreacion(equipmentEntity(ID_EQUIPO), ops)).toEqual(['op-crear']);
  });
});

describe('encolar: archivos', () => {
  const spec = {
    id: 'op-doc',
    endpoint: 'equipmentDocument.create' as const,
    params: { equipmentId: ID_EQUIPO },
    body: { id: 'doc-1', type: 'INSURANCE' as const },
    label: 'Documento',
  };

  it('un PDF se guarda tal cual, en la misma operación, y deja la operación pendiente de subida', async () => {
    const pdf = new File([new Uint8Array([1, 2, 3])], 'poliza.pdf', { type: 'application/pdf' });

    const op = await enqueueHttpWrite('u1', { ...spec, files: [{ field: 'fileKey', file: pdf }] });

    expect(op.status).toBe('pending_upload');
    expect(op.files).toHaveLength(1);
    const blob = await db.blobs.get(op.files![0]!.blobId);
    expect(blob).toMatchObject({ mime: 'application/pdf', name: 'poliza.pdf' });
    expect(new Uint8Array(blob!.data)).toEqual(new Uint8Array([1, 2, 3]));
  });

  it('un formato que el servidor rechazaría se rechaza al guardar, no al sincronizar', async () => {
    const zip = new File([new Uint8Array([1])], 'datos.zip', { type: 'application/zip' });

    await expect(enqueueHttpWrite('u1', { ...spec, files: [{ field: 'fileKey', file: zip }] })).rejects.toMatchObject({
      code: 'FILE_TYPE_NOT_ALLOWED',
    });
    expect(await db.outbox.count()).toBe(0);
    expect(await db.blobs.count()).toBe(0);
  });

  it('un archivo de más de 8 MB se rechaza y no deja nada a medias', async () => {
    const grande = new File([new Uint8Array(9 * 1024 * 1024)], 'grande.pdf', { type: 'application/pdf' });

    await expect(enqueueHttpWrite('u1', { ...spec, files: [{ field: 'fileKey', file: grande }] })).rejects.toMatchObject({
      code: 'FILE_TOO_LARGE',
    });
    expect(await db.outbox.count()).toBe(0);
    expect(await db.blobs.count()).toBe(0);
  });

  it('una foto pasa por la compresión antes de guardarse (nombre y tipo JPEG)', async () => {
    const compress = await import('./photo');
    vi.spyOn(compress, 'compressPhoto').mockResolvedValue({
      data: new Uint8Array([9, 9]).buffer,
      mime: 'image/jpeg',
      name: 'foto.jpg',
    });
    const png = new File([new Uint8Array(500)], 'foto.png', { type: 'image/png' });

    const op = await enqueueHttpWrite('u1', {
      id: 'op-eq',
      endpoint: 'equipment.create',
      params: {},
      body: EQUIPO_BODY,
      label: 'Nuevo equipo',
      files: [{ field: 'photoKey', file: png }],
    });

    const blob = await db.blobs.get(op.files![0]!.blobId);
    expect(compress.compressPhoto).toHaveBeenCalledWith(png);
    expect(blob).toMatchObject({ mime: 'image/jpeg', name: 'foto.jpg' });
    expect(blob!.data.byteLength).toBe(2);
  });
});

describe('cambios que ya esperan en la cola (base de una edición nueva)', () => {
  async function encolar(id: string, endpoint: 'equipment.update' | 'equipment.status', body: object, extra = {}) {
    return enqueueHttpWrite('u1', {
      id,
      endpoint,
      params: { id: ID_EQUIPO },
      body: body as never,
      label: id,
      ...extra,
    });
  }

  it('fusiona los cuerpos en el orden en que se mandarán', async () => {
    await encolar('a', 'equipment.update', { type: 'A', brand: 'Marca' });
    await encolar('b', 'equipment.status', { status: 'IN_WORKSHOP' });
    await encolar('c', 'equipment.update', { type: 'C' });

    const pendiente = await cambiosPendientes(equipmentEntity(ID_EQUIPO), ['equipment.update', 'equipment.status'], 'u1');

    expect(pendiente).toEqual({ type: 'C', brand: 'Marca', status: 'IN_WORKSHOP' });
  });

  it('solo cuenta los endpoints pedidos', async () => {
    await encolar('a', 'equipment.update', { type: 'A' });
    await encolar('b', 'equipment.status', { status: 'IN_WORKSHOP' });

    expect(await cambiosPendientes(equipmentEntity(ID_EQUIPO), ['equipment.status'], 'u1')).toEqual({
      status: 'IN_WORKSHOP',
    });
  });

  it('no cuenta lo que espera una acción humana ni lo de otro usuario', async () => {
    await encolar('a', 'equipment.update', { type: 'A' });
    await db.outbox.update('a', { status: 'needs_attention' });
    await enqueueHttpWrite('u2', {
      id: 'ajena',
      endpoint: 'equipment.update',
      params: { id: ID_EQUIPO },
      body: { type: 'Ajena' },
      label: 'x',
    });

    expect(await cambiosPendientes(equipmentEntity(ID_EQUIPO), ['equipment.update'], 'u1')).toEqual({});
    expect((await escriturasPendientes(equipmentEntity(ID_EQUIPO), undefined, 'u1')).map((op) => op.id)).toEqual([]);
  });

  it('sin sesión del motor ni usuario, no hay nada que contar', async () => {
    await encolar('a', 'equipment.update', { type: 'A' });

    expect(await cambiosPendientes(equipmentEntity(ID_EQUIPO), ['equipment.update'])).toEqual({});
  });
});

describe('replay de una escritura de oficina', () => {
  async function put(op: Partial<HttpWriteOp> & Pick<HttpWriteOp, 'id' | 'endpoint' | 'params' | 'body'>) {
    const seq = (await db.outbox.count()) + 1;
    await db.outbox.put({
      type: 'httpWrite',
      v: 1,
      userId: 'u1',
      label: 'x',
      status: 'pending',
      attempts: 0,
      seq,
      createdAt: seq,
      updatedAt: seq,
      ...op,
    });
  }

  it('un create manda el id del cliente y la key de la foto subida en el campo de la entrada', async () => {
    uploadFileMock.mockResolvedValueOnce({ key: 'tmp/u1/foto.jpg', url: 'u' });
    sendWriteMock.mockResolvedValueOnce({ id: ID_EQUIPO });
    await db.blobs.put({ id: 'b-1', data: new Uint8Array([1]).buffer, mime: 'image/jpeg', name: 'foto.jpg', createdAt: 1 });
    await put({
      id: 'op-eq',
      endpoint: 'equipment.create',
      params: {},
      body: EQUIPO_BODY,
      status: 'pending_upload',
      files: [{ field: 'photoKey', blobId: 'b-1' }],
      creates: true,
    });

    await syncAndSettle();

    const request = sendWriteMock.mock.calls[0]![0];
    expect(request).toMatchObject({ method: 'POST', url: '/api/equipment' });
    expect(request.body).toEqual({ ...EQUIPO_BODY, photoKey: 'tmp/u1/foto.jpg' });
    expect(await db.outbox.get('op-eq')).toBeUndefined();
    expect(await db.blobs.get('b-1')).toBeUndefined();
  });

  it('una cadena crear → asignar se manda en ese orden y la asignación espera a la creación', async () => {
    sendWriteMock.mockResolvedValue(undefined);
    await put({ id: 'op-crear', endpoint: 'equipment.create', params: {}, body: EQUIPO_BODY, creates: true, entityKey: equipmentEntity(ID_EQUIPO) });
    await put({
      id: 'op-asignar',
      endpoint: 'equipment.assign',
      params: { id: ID_EQUIPO },
      body: { operatorId: 'op_1' },
      expected: { operatorId: null },
      dependsOn: ['op-crear'],
      entityKey: equipmentEntity(ID_EQUIPO),
    });

    await syncAndSettle();

    expect(sendWriteMock.mock.calls.map(([r]) => `${r.method} ${r.url}`)).toEqual([
      'POST /api/equipment',
      `PATCH /api/equipment/${ID_EQUIPO}/assignment`,
    ]);
    expect(JSON.parse(decodeURIComponent(sendWriteMock.mock.calls[1]![0].headers['X-Expected']))).toEqual({
      operatorId: null,
    });
  });

  it('si la creación necesita atención, la asignación que depende de ella no se manda', async () => {
    sendWriteMock.mockRejectedValueOnce(new DomainError('El código ya existe', { status: 409 }));
    await put({ id: 'op-crear', endpoint: 'equipment.create', params: {}, body: EQUIPO_BODY, creates: true, entityKey: equipmentEntity(ID_EQUIPO) });
    await put({
      id: 'op-asignar',
      endpoint: 'equipment.assign',
      params: { id: ID_EQUIPO },
      body: { operatorId: 'op_1' },
      dependsOn: ['op-crear'],
      entityKey: equipmentEntity(ID_EQUIPO),
    });

    await syncAndSettle();

    expect(sendWriteMock).toHaveBeenCalledTimes(1);
    // Un 409 sin `code` en un create es un choque con otra fila: negocio, con el mensaje del servidor.
    expect(await db.outbox.get('op-crear')).toMatchObject({
      status: 'needs_attention',
      lastError: { message: 'El código ya existe', status: 409 },
    });
    expect((await db.outbox.get('op-asignar'))?.status).toBe('pending');
  });

  it('ID_CONFLICT en un create es terminal: queda para atención con el texto de "descartá y volvé a crear"', async () => {
    sendWriteMock.mockRejectedValueOnce(new DomainError('conflict', { code: 'ID_CONFLICT', status: 409 }));
    await put({ id: 'op-crear', endpoint: 'equipment.create', params: {}, body: EQUIPO_BODY, creates: true });

    await syncAndSettle();

    const op = await db.outbox.get('op-crear');
    expect(op?.status).toBe('needs_attention');
    expect(op?.lastError?.message).toContain('Descartá este registro');
  });

  it('un DELETE reintentado cuyo recurso ya no existe (404) cuenta como hecho', async () => {
    sendWriteMock.mockRejectedValueOnce(new DomainError('Not Found', { status: 404 }));
    await put({ id: 'op-borrar', endpoint: 'equipment.delete', params: { id: ID_EQUIPO }, body: {} });

    await syncAndSettle();

    expect(await db.outbox.get('op-borrar')).toBeUndefined();
  });

  it('el 404 de una escritura que NO es un borrado sigue siendo un rechazo', async () => {
    sendWriteMock.mockRejectedValueOnce(new DomainError('Not Found', { status: 404 }));
    await put({ id: 'op-estado', endpoint: 'equipment.status', params: { id: ID_EQUIPO }, body: { status: 'IN_WORKSHOP' } });

    await syncAndSettle();

    expect((await db.outbox.get('op-estado'))?.status).toBe('needs_attention');
  });

  it('un STALE_UPDATE queda para atención con su código (la hoja ofrece Sobrescribir)', async () => {
    sendWriteMock.mockRejectedValueOnce(new DomainError('stale', { code: 'STALE_UPDATE', status: 409 }));
    await put({
      id: 'op-edicion',
      endpoint: 'branch.update',
      params: { id: 'br-1' },
      body: { name: 'Nuevo' },
      expected: { name: 'Viejo' },
    });

    await syncAndSettle();

    expect(await db.outbox.get('op-edicion')).toMatchObject({ status: 'needs_attention', lastError: { code: 'STALE_UPDATE' } });
  });
});

describe('submitWrite de oficina', () => {
  it('devuelve el id de la operación para encadenar, enviada o en cola', async () => {
    sendWriteMock.mockResolvedValueOnce(undefined);
    setCurrentUser('u1');

    const enviada = await submitWrite(
      'branch.delete',
      { params: { id: 'br-1' }, body: {} },
      { waitMs: 3000 },
    );
    const encolada = await submitWrite(
      'branch.delete',
      { params: { id: 'br-2' }, body: {} },
      { waitMs: 0 },
    );

    expect(enviada.status).toBe('sent');
    expect(enviada.opId).toEqual(expect.any(String));
    expect(encolada).toEqual({ status: 'queued', opId: expect.any(String) });
    expect(await db.outbox.get(encolada.opId)).toMatchObject({ endpoint: 'branch.delete', label: expect.stringContaining('Eliminación') });
  });

  it('un 409 de negocio mientras se espera sale como error y no deja la operación en la cola', async () => {
    sendWriteMock.mockRejectedValueOnce(new DomainError('Ya existe una sucursal con ese nombre', { status: 409 }));
    setCurrentUser('u1');

    await expect(
      submitWrite('branch.create', { params: {}, body: { id: 'br-1', name: 'Centro' } }, { waitMs: 3000 }),
    ).rejects.toMatchObject({ message: 'Ya existe una sucursal con ese nombre', status: 409 });
    expect(await db.outbox.count()).toBe(0);
  });

  it('INSUFFICIENT_STOCK sale con un texto claro', async () => {
    sendWriteMock.mockRejectedValueOnce(new DomainError('Existencia insuficiente', { code: 'INSUFFICIENT_STOCK', status: 409 }));
    setCurrentUser('u1');

    await expect(
      submitWrite(
        'movement.create',
        { params: {}, body: { id: 'm-1', itemId: 'i-1', branchId: 'b-1', direction: 'OUT', reason: 'ACTIVITY', quantity: 5 } },
        { waitMs: 3000 },
      ),
    ).rejects.toMatchObject({ code: 'INSUFFICIENT_STOCK', message: expect.stringContaining('existencia suficiente') });
  });
});
