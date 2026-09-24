import { afterEach, describe, expect, it, vi } from 'vitest';

import { uploadFile, uploadImage } from './UploadsAPI';

// Los mocks de axios se declaran con `vi.hoisted` porque `vi.mock` se
// "hoistea" arriba de los imports — mismo criterio que `EquipmentAPI.test.ts`.
const { postMock } = vi.hoisted(() => ({
  postMock: vi.fn(),
}));

vi.mock('../lib/axios', () => ({
  axiosInstance: {
    post: postMock,
  },
}));

afterEach(() => {
  vi.clearAllMocks();
});

function archivo(bytes: number, type = 'image/jpeg', nombre = 'foto.jpg'): File {
  return new File([new Uint8Array(bytes)], nombre, { type });
}

/** Construye un error "de axios" con un status HTTP, sin depender de
 * disparar una request real — mismo helper que `EquipmentAPI.test.ts`, pero
 * con `status` en vez de `message` (lo que `uploadFile` inspecciona para
 * mapear 413/415). */
function axiosErrorConStatus(status: number, message?: string): Error {
  return Object.assign(new Error('Request failed'), {
    isAxiosError: true,
    response: { status, data: message ? { message } : {} },
  });
}

describe('uploadFile', () => {
  it('postea a /api/files con el header multipart explícito y devuelve {key, url}', async () => {
    postMock.mockResolvedValueOnce({
      data: { data: { key: 'tmp/u1/abc.jpg', url: 'https://minio.local/signed' }, message: 'Archivo subido' },
    });

    const result = await uploadFile(archivo(1024));

    expect(postMock).toHaveBeenCalledWith(
      '/api/files',
      expect.any(FormData),
      expect.objectContaining({ headers: { 'Content-Type': 'multipart/form-data' } }),
    );
    expect(result).toEqual({ key: 'tmp/u1/abc.jpg', url: 'https://minio.local/signed' });
  });

  it('rechaza en el cliente un archivo mayor a 8 MB sin llamar a la API', async () => {
    const grande = archivo(8 * 1024 * 1024 + 1);

    await expect(uploadFile(grande)).rejects.toThrow('El archivo supera el máximo de 8 MB.');
    expect(postMock).not.toHaveBeenCalled();
  });

  it('acepta un archivo de exactamente 8 MB', async () => {
    postMock.mockResolvedValueOnce({
      data: { data: { key: 'tmp/u1/limite.jpg', url: 'https://minio.local/limite' }, message: 'ok' },
    });

    await expect(uploadFile(archivo(8 * 1024 * 1024))).resolves.toBeTruthy();
    expect(postMock).toHaveBeenCalled();
  });

  it.each(['image/gif', 'image/svg+xml', 'text/html', 'application/octet-stream'])(
    'rechaza en el cliente un mimetype no permitido (%s) sin llamar a la API',
    async (mimetype) => {
      await expect(uploadFile(archivo(100, mimetype))).rejects.toThrow(
        'Formato no permitido. Solo se aceptan JPG, PNG, WebP o PDF.',
      );
      expect(postMock).not.toHaveBeenCalled();
    },
  );

  it.each(['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])(
    'acepta el mimetype permitido %s',
    async (mimetype) => {
      postMock.mockResolvedValueOnce({
        data: { data: { key: 'tmp/u1/x', url: 'https://minio.local/x' }, message: 'ok' },
      });

      await expect(uploadFile(archivo(100, mimetype))).resolves.toBeTruthy();
    },
  );

  it('mapea un 413 del backend a un mensaje claro en español (el de Multer/Nest no lo trae)', async () => {
    postMock.mockRejectedValueOnce(axiosErrorConStatus(413, 'File too large'));

    await expect(uploadFile(archivo(1024))).rejects.toThrow('El archivo supera el máximo de 8 MB.');
  });

  it('mapea un 415 del backend (bytes reales no matchean) al mismo mensaje que el pre-chequeo', async () => {
    postMock.mockRejectedValueOnce(
      axiosErrorConStatus(415, 'El archivo no es una imagen (JPEG/PNG/WebP) ni un PDF válido'),
    );

    await expect(uploadFile(archivo(1024))).rejects.toThrow(
      'Formato no permitido. Solo se aceptan JPG, PNG, WebP o PDF.',
    );
  });

  it('para otros errores del backend, prioriza el mensaje del backend (toDomainError)', async () => {
    postMock.mockRejectedValueOnce(axiosErrorConStatus(403, 'Sin permisos para subir archivos'));

    await expect(uploadFile(archivo(1024))).rejects.toThrow('Sin permisos para subir archivos');
  });

  it('sin mensaje del backend, usa el fallback (no el mensaje técnico de axios)', async () => {
    postMock.mockRejectedValueOnce(Object.assign(new Error('Network Error'), { isAxiosError: true }));

    await expect(uploadFile(archivo(1024))).rejects.toThrow('No se pudo subir el archivo.');
  });
});

describe('uploadImage (legacy Terreno, sin cambios)', () => {
  it('sigue posteando a /api/uploads con el header multipart y devolviendo la url', async () => {
    postMock.mockResolvedValueOnce({ data: { data: { url: '/uploads/foto.jpg' }, message: 'ok' } });

    const result = await uploadImage(archivo(1024));

    expect(postMock).toHaveBeenCalledWith(
      '/api/uploads',
      expect.any(FormData),
      expect.objectContaining({ headers: { 'Content-Type': 'multipart/form-data' } }),
    );
    expect(result).toBe('/uploads/foto.jpg');
  });
});
