import { describe, expect, it } from 'vitest';

import { isSignedFileUrl, stripSignedUrlQuery } from './signed-url-cache';

describe('isSignedFileUrl', () => {
  it('reconoce una URL firmada por su query X-Amz-Signature (MinIO local)', () => {
    const url = new URL(
      'http://localhost:9000/smi-files/equipment-photos/abc-123.jpg' +
        '?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Signature=deadbeef',
    );

    expect(isSignedFileUrl(url)).toBe(true);
  });

  it('reconoce una URL firmada de R2 (dominio de producción)', () => {
    const url = new URL(
      'https://abc123.r2.cloudflarestorage.com/smi-files/equipment-documents/doc.pdf?X-Amz-Signature=cafe',
    );

    expect(isSignedFileUrl(url)).toBe(true);
  });

  it('no reconoce una URL legacy de /uploads (Terreno, sin firma)', () => {
    const url = new URL('http://localhost:3001/uploads/foto-1234.jpg');

    expect(isSignedFileUrl(url)).toBe(false);
  });

  it('no reconoce una URL de la API sin query de firma', () => {
    const url = new URL('http://localhost:3001/api/equipment');

    expect(isSignedFileUrl(url)).toBe(false);
  });
});

describe('stripSignedUrlQuery', () => {
  it('quita el query string manteniendo el resto de la URL', () => {
    const stripped = stripSignedUrlQuery(
      'http://localhost:9000/smi-files/equipment-photos/abc-123.jpg?X-Amz-Signature=deadbeef&X-Amz-Expires=3600',
    );

    expect(stripped).toBe('http://localhost:9000/smi-files/equipment-photos/abc-123.jpg');
  });

  it('dos URLs con la misma key pero firma distinta quedan bajo la misma cache key (objeto inmutable)', () => {
    const primeraVentana = stripSignedUrlQuery(
      'http://localhost:9000/smi-files/fuel-photos/xyz.jpg?X-Amz-Signature=firma1&X-Amz-Expires=3600',
    );
    const segundaVentana = stripSignedUrlQuery(
      'http://localhost:9000/smi-files/fuel-photos/xyz.jpg?X-Amz-Signature=firma2&X-Amz-Expires=3600',
    );

    expect(primeraVentana).toBe(segundaVentana);
  });

  it('una URL sin query queda igual', () => {
    expect(stripSignedUrlQuery('http://localhost:3001/uploads/foto.jpg')).toBe(
      'http://localhost:3001/uploads/foto.jpg',
    );
  });
});
