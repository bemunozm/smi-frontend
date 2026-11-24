import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useState } from 'react';

const { toastMock, readCaptureDateMock } = vi.hoisted(() => ({
  toastMock: { danger: vi.fn(), warning: vi.fn(), success: vi.fn() },
  readCaptureDateMock: vi.fn<(file: File) => Promise<Date | null>>(),
}));

vi.mock('@heroui/react', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@heroui/react')>()),
  toast: toastMock,
}));
vi.mock('../../lib/photo-reading', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../lib/photo-reading')>()),
  readCaptureDate: readCaptureDateMock,
}));

import { mockObjectUrls } from '../../test/object-url';
import { FotosField } from './FotosField';

type Foto = File | { id: string; url: string };

let restaurarUrls: () => void;
beforeEach(() => {
  restaurarUrls = mockObjectUrls();
  readCaptureDateMock.mockResolvedValue(null);
});
afterEach(() => {
  cleanup();
  restaurarUrls();
  vi.clearAllMocks();
});

const foto = (n: number) => new File([String(n)], `foto-${n}.jpg`, { type: 'image/jpeg' });

/** Una foto cuyo contenido el teléfono ya no deja leer (permiso revocado). */
function fotoIlegible(n: number): File {
  const f = foto(n);
  f.arrayBuffer = () => Promise.reject(new DOMException('The requested file could not be read', 'NotReadableError'));
  return f;
}

let ultima: Foto[] = [];

function Harness({
  iniciales = [],
  ...props
}: { iniciales?: Foto[] } & Omit<Parameters<typeof FotosField<Foto>>[0], 'fotos' | 'onChange'>) {
  const [fotos, setFotos] = useState<Foto[]>(iniciales);
  return (
    <FotosField<Foto>
      {...props}
      fotos={fotos}
      onChange={(nuevas) => {
        ultima = nuevas;
        setFotos(nuevas);
      }}
    />
  );
}

function elegirDeGaleria(files: File[]) {
  const galeria = document.querySelector('input[type="file"][multiple]');
  if (!galeria) throw new Error('input de galería no encontrado');
  fireEvent.change(galeria, { target: { files } });
}

const miniaturas = () => screen.queryAllByRole('img', { name: /^Foto \d+$/ });

describe('FotosField', () => {
  it('avisa en ámbar las fotos que no son recientes (EXIF), solo con preguntaAntigua', async () => {
    const vieja = foto(1);
    readCaptureDateMock.mockImplementation(async (f) =>
      f === vieja ? new Date(Date.now() - 3 * 24 * 3600 * 1000) : new Date(),
    );
    render(<Harness preguntaAntigua="¿Es del trabajo recién terminado?" />);
    elegirDeGaleria([vieja, foto(2)]);

    await waitFor(() => expect(screen.getByText(/¿Es del trabajo recién terminado\?/)).toBeTruthy());
    expect(screen.getAllByText(/¿Es del trabajo recién terminado\?/)).toHaveLength(1);
    expect(screen.getByText(/Foto tomada hace 3 días/)).toBeTruthy();
  });

  it('en una mezcla de guardadas y nuevas, quitar una deja las demás en orden', () => {
    const guardada = { id: 'p1', url: 'https://s/guardada.jpg' };
    const nueva = foto(2);
    render(<Harness iniciales={[guardada, nueva, { id: 'p3', url: 'https://s/otra.jpg' }]} />);
    expect(miniaturas()).toHaveLength(3);

    fireEvent.click(screen.getByRole('button', { name: 'Quitar foto 1' }));
    expect(ultima).toEqual([nueva, { id: 'p3', url: 'https://s/otra.jpg' }]);
    expect(miniaturas().map((img) => img.getAttribute('src'))).toEqual([
      expect.stringMatching(/^blob:/),
      'https://s/otra.jpg',
    ]);
  });

  it('si en la galería se eligen de más, agrega las que caben y avisa', () => {
    render(<Harness iniciales={Array.from({ length: 8 }, (_, i) => foto(i))} />);
    elegirDeGaleria([foto(10), foto(11), foto(12)]);

    expect(miniaturas()).toHaveLength(10);
    expect(toastMock.warning).toHaveBeenCalledWith('Se agregaron 2 de 3: el máximo es 10 fotos.');
    expect(screen.queryByRole('button', { name: /Agregar otra foto/ })).toBeNull();
  });

  it('con copiarAMemoria agrega copias en memoria; una foto ilegible no se agrega y se avisa', async () => {
    const buena = foto(1);
    render(<Harness copiarAMemoria />);
    elegirDeGaleria([buena, fotoIlegible(2)]);

    await waitFor(() => expect(miniaturas()).toHaveLength(1));
    expect(toastMock.danger).toHaveBeenCalledWith(expect.stringMatching(/No se pudo leer la foto/));
    // Una copia (otro objeto), con el mismo nombre, tipo y contenido.
    const [copia] = ultima as File[];
    expect(copia).not.toBe(buena);
    expect(copia.name).toBe('foto-1.jpg');
    expect(copia.type).toBe('image/jpeg');
    expect(await copia.text()).toBe('1');
  });

  it('variante panel: botón «Agregar fotos» (sin cámara directa) y quitar con botón', () => {
    render(<Harness label="Fotos de lo realizado" variante="panel" />);
    expect(screen.getByRole('button', { name: /Agregar fotos/ })).toBeTruthy();
    expect(document.querySelector('input[capture]')).toBeNull();

    elegirDeGaleria([foto(1), foto(2)]);
    expect(miniaturas()).toHaveLength(2);
    fireEvent.click(screen.getByRole('button', { name: 'Quitar foto 1' }));
    expect(miniaturas()).toHaveLength(1);
  });
});
