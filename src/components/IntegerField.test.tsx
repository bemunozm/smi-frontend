import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';

import { IntegerField } from './IntegerField';

afterEach(cleanup);

function Campo({ inicial = 1, alCambiar }: { inicial?: number; alCambiar: (valor: number) => void }) {
  const [valor, setValor] = useState(inicial);
  return (
    <IntegerField
      label="Cantidad"
      onChange={(nuevo) => {
        setValor(nuevo);
        alCambiar(nuevo);
      }}
      value={valor}
    />
  );
}

const escribir = (texto: string) => fireEvent.change(screen.getByLabelText('Cantidad'), { target: { value: texto } });
const campo = () => screen.getByLabelText('Cantidad') as HTMLInputElement;

describe('IntegerField', () => {
  it.each([
    ['1200', 1200],
    ['1.200', 1200],
    ['1,200', 1200],
  ])('%s vale %d, sin depender del idioma del equipo', (texto, esperado) => {
    const alCambiar = vi.fn();
    render(<Campo alCambiar={alCambiar} />);

    escribir(texto);

    expect(alCambiar).toHaveBeenLastCalledWith(esperado);
  });

  it.each(['12,5', '1.20', '12.3456', 'abc', ''])('%j entrega NaN y deja el texto como se escribió', (texto) => {
    const alCambiar = vi.fn();
    render(<Campo alCambiar={alCambiar} />);

    escribir(texto);

    expect(alCambiar).toHaveBeenLastCalledWith(Number.NaN);
    expect(campo().value).toBe(texto);
  });

  it('no avisa cómo se leerá "2.130": en un entero no hay ambigüedad', () => {
    render(<Campo alCambiar={vi.fn()} />);

    escribir('2.130');

    expect(screen.queryByRole('status')).toBeNull();
  });

  it('pide el teclado numérico y parte mostrando el valor sin decimales', () => {
    render(<Campo alCambiar={vi.fn()} inicial={250} />);

    expect(campo().value).toBe('250');
    expect(campo().inputMode).toBe('numeric');
  });
});
