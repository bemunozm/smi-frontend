import { afterEach, describe, expect, it, vi } from 'vitest';

import { fuelReadingOcr } from './OcrAPI';

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

const FILE = new File(['x'], 'surtidor.jpg', { type: 'image/jpeg' });

describe('fuelReadingOcr', () => {
  it('postea multipart/form-data con el archivo y devuelve value/status/confidence', async () => {
    postMock.mockResolvedValueOnce({
      data: {
        data: { value: '183.089', status: 'CONFIRMED', confidence: 0.92 },
        message: 'ok',
      },
    });

    const result = await fuelReadingOcr(FILE);

    // Verifica también el header multipart explícito: sin él, axios v1 serializa
    // el FormData a JSON y el backend responde 400 "No se recibió archivo" (bug real).
    expect(postMock).toHaveBeenCalledWith('/api/ocr/fuel-reading', expect.any(FormData), {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    const form = postMock.mock.calls[0][1] as FormData;
    expect(form.get('file')).toBe(FILE);
    // El backend ya manda el punto decimal puesto — el front no lo inserta.
    expect(result).toEqual({ value: '183.089', status: 'CONFIRMED', confidence: 0.92 });
  });

  it('propaga un resultado REVIEW tal cual (los modelos difirieron o solo uno leyó)', async () => {
    postMock.mockResolvedValueOnce({
      data: { data: { value: '80.5', status: 'REVIEW', confidence: 0.6 }, message: 'ok' },
    });

    await expect(fuelReadingOcr(FILE)).resolves.toEqual({ value: '80.5', status: 'REVIEW', confidence: 0.6 });
  });

  it('si el backend no pudo leer la foto (UNREADABLE, value: null), lo propaga tal cual — no es un error', async () => {
    postMock.mockResolvedValueOnce({
      data: { data: { value: null, status: 'UNREADABLE', confidence: 0 }, message: 'ok' },
    });

    await expect(fuelReadingOcr(FILE)).resolves.toEqual({ value: null, status: 'UNREADABLE', confidence: 0 });
  });

  it('si la request falla (red, 401 sin sesión, 400 archivo inválido), no rompe: resuelve sin sugerencia', async () => {
    postMock.mockRejectedValueOnce(
      Object.assign(new Error('Request failed'), { isAxiosError: true, response: { status: 401 } }),
    );

    await expect(fuelReadingOcr(FILE)).resolves.toEqual({ value: null, status: 'UNREADABLE', confidence: 0 });
  });
});
