import { describe, expect, it, vi } from 'vitest';

import { compressPhoto, type ImageBitmapLike, type PhotoCompressionDeps } from './photo';

function makeFile(bytes: number[] = [1, 2, 3, 4], name = 'surtidor.jpg', type = 'image/jpeg'): File {
  return new File([new Uint8Array(bytes)], name, { type });
}

describe('compressPhoto', () => {
  it('reduce al lado mayor a 1280 px y produce un JPEG q0.72 — inyecta el pipeline, sin canvas real', async () => {
    const bitmap: ImageBitmapLike = { width: 3200, height: 1600, close: vi.fn() };
    const encodeJpeg = vi.fn().mockResolvedValue(new Blob([new Uint8Array([9, 9, 9])], { type: 'image/jpeg' }));
    const deps: PhotoCompressionDeps = {
      createBitmap: vi.fn().mockResolvedValue(bitmap),
      encodeJpeg,
    };

    const result = await compressPhoto(makeFile(), deps);

    expect(encodeJpeg).toHaveBeenCalledWith(bitmap, 1280, 640, 0.72);
    expect(result.mime).toBe('image/jpeg');
    expect(result.name).toBe('surtidor.jpg');
    expect(result.data.byteLength).toBe(3);
    expect(bitmap.close).toHaveBeenCalledTimes(1);
  });

  it('no achica una foto que ya es más chica que el máximo (nunca escala hacia arriba)', async () => {
    const bitmap: ImageBitmapLike = { width: 800, height: 600 };
    const encodeJpeg = vi.fn().mockResolvedValue(new Blob([new Uint8Array([1])]));
    const deps: PhotoCompressionDeps = { createBitmap: vi.fn().mockResolvedValue(bitmap), encodeJpeg };

    await compressPhoto(makeFile(), deps);

    expect(encodeJpeg).toHaveBeenCalledWith(bitmap, 800, 600, 0.72);
  });

  it('cambia la extensión a .jpg aunque el original sea .png', async () => {
    const bitmap: ImageBitmapLike = { width: 100, height: 100 };
    const deps: PhotoCompressionDeps = {
      createBitmap: vi.fn().mockResolvedValue(bitmap),
      encodeJpeg: vi.fn().mockResolvedValue(new Blob([new Uint8Array([1])])),
    };

    const result = await compressPhoto(makeFile([1], 'foto.png', 'image/png'), deps);

    expect(result.name).toBe('foto.jpg');
  });

  it('fallback: sin `createBitmap` disponible, guarda los bytes originales tal cual', async () => {
    const deps = { createBitmap: undefined, encodeJpeg: vi.fn() } as unknown as PhotoCompressionDeps;

    const original = makeFile([1, 2, 3, 4, 5]);
    const result = await compressPhoto(original, deps);

    expect(result.mime).toBe('image/jpeg');
    expect(result.data.byteLength).toBe(5);
    expect(deps.encodeJpeg).not.toHaveBeenCalled();
  });

  it('fallback: si `createBitmap` lanza, cae a los bytes originales sin romper', async () => {
    const deps: PhotoCompressionDeps = {
      createBitmap: vi.fn().mockRejectedValue(new Error('no soportado')),
      encodeJpeg: vi.fn(),
    };

    const result = await compressPhoto(makeFile([7, 7, 7]), deps);

    expect(result.data.byteLength).toBe(3);
    expect(result.mime).toBe('image/jpeg');
  });

  it('fallback: si `encodeJpeg` devuelve `null` (canvas sin contexto 2D), cae a los bytes originales', async () => {
    const deps: PhotoCompressionDeps = {
      createBitmap: vi.fn().mockResolvedValue({ width: 100, height: 100 }),
      encodeJpeg: vi.fn().mockResolvedValue(null),
    };

    const result = await compressPhoto(makeFile([4, 4]), deps);

    expect(result.data.byteLength).toBe(2);
  });
});
