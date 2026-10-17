import { describe, expect, it } from 'vitest';

import { injectFileKeys } from './inject-file-keys';

describe('injectFileKeys', () => {
  it('un campo de primer nivel queda igual que antes', () => {
    const body = { detalle: 'x' };
    expect(injectFileKeys(body, [{ field: 'fotoKey', tmpKey: 'tmp/u/a.jpg' }])).toEqual({
      detalle: 'x',
      fotoKey: 'tmp/u/a.jpg',
    });
    expect(body).toEqual({ detalle: 'x' });
  });

  it('una ruta con puntos llega a la foto de un ítem sin tocar el original', () => {
    const body = {
      entries: [{ itemId: 'a' }, { itemId: 'b', photoKeys: [] as string[] }],
    };
    const out = injectFileKeys(body, [
      { field: 'entries.1.photoKeys.0', tmpKey: 'tmp/u/1.jpg' },
      { field: 'entries.1.photoKeys.1', tmpKey: 'tmp/u/2.jpg' },
      { field: 'entries.0.photoKeys.0', tmpKey: 'tmp/u/3.jpg' },
    ]);
    expect(out).toEqual({
      entries: [
        { itemId: 'a', photoKeys: ['tmp/u/3.jpg'] },
        { itemId: 'b', photoKeys: ['tmp/u/1.jpg', 'tmp/u/2.jpg'] },
      ],
    });
    expect(body.entries[1].photoKeys).toEqual([]);
  });
});
