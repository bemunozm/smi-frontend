import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';

import { Cifras } from './ui';

afterEach(cleanup);

const LABELS = ['Km inicial', 'Km final', 'Recorrido', 'Litros', 'AdBlue', 'Otra'];
const items = (n: number) => LABELS.slice(0, n).map((label) => ({ label, valor: '22.000 km' }));

const grilla = () => screen.getByText('Km inicial').closest('dl')!;

describe('Cifras', () => {
  it('con 4 cifras va de a 2 en una tarjeta angosta y en una fila cuando cabe (no corta «22.000 km»)', () => {
    render(<Cifras items={items(4)} />);
    expect(grilla().className).toContain('grid-cols-2');
    expect(grilla().className).toContain('@min-[26rem]:grid-cols-4');
    expect(grilla().parentElement!.className).toContain('@container');
  });

  it('con 3 cifras, 2 + 1 en una tarjeta angosta y una fila cuando cabe', () => {
    render(<Cifras items={items(3)} />);
    expect(grilla().className).toContain('grid-cols-2');
    expect(grilla().className).toContain('@min-[22rem]:grid-cols-3');
  });

  it('con 2 cifras, una sola fila', () => {
    render(<Cifras items={items(2)} />);
    expect(grilla().className).toContain('grid-cols-2');
    expect(grilla().className).not.toContain('@min-');
  });

  it('con 6 o más, filas de 3', () => {
    render(<Cifras items={items(6)} />);
    expect(grilla().className).not.toContain('@min-');
    expect(grilla().className).toContain('grid-cols-3');
  });

  it('con 5 cifras, 3 + 2 en angosto y una fila cuando cabe', () => {
    render(<Cifras items={items(5)} />);
    expect(grilla().className).toContain('grid-cols-3');
    expect(grilla().className).toContain('@min-[34rem]:grid-cols-5');
  });

  it('ni la etiqueta ni el valor parten en dos líneas', () => {
    render(<Cifras items={items(4)} />);
    expect(screen.getByText('Km inicial').className).toContain('whitespace-nowrap');
    expect(screen.getAllByText('22.000 km')[0]!.className).toContain('whitespace-nowrap');
  });
});
