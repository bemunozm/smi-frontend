import 'fake-indexeddb/auto';
import Dexie from 'dexie';
import { afterEach, describe, expect, it, vi } from 'vitest';

/**
 * La versión 2 del schema (seq, dependsOn/entityKey, tabla `blobs`) tiene que
 * conservar lo que un equipo ya tenía guardado con la versión 1: operaciones
 * sin sincronizar y fotos. Se siembra una base v1 con Dexie "a mano" y luego se
 * abre la `db` real, que dispara la migración.
 */

const T0 = 1_760_000_000_000;

async function seedV1(): Promise<void> {
  const legacy = new Dexie('smi-offline');
  legacy.version(1).stores({ outbox: 'id, [userId+createdAt], status', photos: 'id' });
  await legacy.table('outbox').bulkPut([
    // Mismo `createdAt` que la anterior a propósito: el desempate tiene que
    // respetar el orden en que se guardaron.
    { id: 'close-1', type: 'closeCard', v: 1, userId: 'u1', status: 'pending_upload', attempts: 0, photoId: 'close-1', createdAt: T0 + 5, updatedAt: T0 + 5, payload: { cardId: 'card-1', input: { closeClientId: 'close-1' } } },
    { id: 'card-1', type: 'openCard', v: 1, userId: 'u1', status: 'pending', attempts: 0, createdAt: T0, updatedAt: T0, payload: { id: 'card-1' } },
    { id: 'h-1', type: 'createHallazgo', v: 1, userId: 'u1', status: 'pending_claim', attempts: 2, tmpKey: 'tmp/u1/x.jpg', photoId: 'h-1', createdAt: T0 + 5, updatedAt: T0 + 5, payload: { id: 'h-1' } },
  ]);
  await legacy.table('photos').bulkPut([
    { id: 'close-1', data: new Uint8Array([1, 2, 3]).buffer, mime: 'image/jpeg', name: 'cierre.jpg', createdAt: T0 },
    { id: 'h-1', data: new Uint8Array([9]).buffer, mime: 'image/jpeg', name: 'h.jpg', createdAt: T0 },
  ]);
  legacy.close();
}

afterEach(async () => {
  const { db } = await import('./db');
  db.close();
  await Dexie.delete('smi-offline');
  vi.resetModules();
});

describe('Dexie v1 → v2', () => {
  it('conserva las operaciones y les asigna un seq en el orden en que se guardaron', async () => {
    await seedV1();
    const { db } = await import('./db');

    const ops = await db.outbox.where('[userId+seq]').between(['u1', -Infinity], ['u1', Infinity]).toArray();

    expect(ops.map((o) => o.id)).toEqual(['card-1', 'close-1', 'h-1']);
    // Estrictamente creciente: el empate de `createdAt` se desempata.
    expect(ops[1]!.seq).toBeGreaterThan(ops[0]!.seq);
    expect(ops[2]!.seq).toBeGreaterThan(ops[1]!.seq);
    // El estado de cada una (incluida la key ya subida) sigue igual.
    expect(ops[2]).toMatchObject({ status: 'pending_claim', tmpKey: 'tmp/u1/x.jpg', attempts: 2 });
  });

  it('enlaza por entidad: el cierre depende de la apertura de su tarjeta', async () => {
    await seedV1();
    const { db } = await import('./db');

    expect(await db.outbox.get('card-1')).toMatchObject({ entityKey: 'shift-card:card-1' });
    expect(await db.outbox.get('close-1')).toMatchObject({ entityKey: 'shift-card:card-1', dependsOn: ['card-1'] });
    expect(await db.outbox.get('h-1')).toMatchObject({ entityKey: 'hallazgo:h-1' });
  });

  it('pasa las fotos a `blobs` con el mismo id y bytes', async () => {
    await seedV1();
    const { db } = await import('./db');

    const blob = await db.blobs.get('close-1');
    expect(blob).toMatchObject({ mime: 'image/jpeg', name: 'cierre.jpg' });
    expect(Array.from(new Uint8Array(blob!.data))).toEqual([1, 2, 3]);
    expect(await db.blobs.count()).toBe(2);
  });

  it('una base nueva (sin v1) abre vacía', async () => {
    const { db } = await import('./db');
    expect(await db.outbox.count()).toBe(0);
    expect(await db.blobs.count()).toBe(0);
  });
});
