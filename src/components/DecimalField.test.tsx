import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';

import { DecimalField } from './DecimalField';

afterEach(cleanup);

function Campo({ inicial = 0, alCambiar }: { inicial?: number; alCambiar: (valor: number) => void }) {
  const [valor, setValor] = useState(inicial);
  return (
    <>
      <DecimalField
        label="Litros"
        onChange={(nuevo) => {
          setValor(nuevo);
          alCambiar(nuevo);
        }}
        value={valor}
      />
      <button onClick={() => setValor(7.5)} type="button">
        Leer del OCR
      </button>
    </>
  );
}

const escribir = (texto: string) => fireEvent.change(screen.getByLabelText('Litros'), { target: { value: texto } });
const campo = () => screen.getByLabelText('Litros') as HTMLInputElement;

describe('DecimalField', () => {
  it('un punto o una coma sueltos son el decimal, nunca el separador de miles', () => {
    const alCambiar = vi.fn();
    render(<Campo alCambiar={alCambiar} />);

    escribir('12.5');
    expect(alCambiar).toHaveBeenLastCalledWith(12.5);

    escribir('12,5');
    expect(alCambiar).toHaveBeenLastCalledWith(12.5);

    escribir('2112.5');
    expect(alCambiar).toHaveBeenLastCalledWith(2112.5);
  });

  it('lo que no es un número entrega NaN y deja el texto como se escribió', () => {
    const alCambiar = vi.fn();
    render(<Campo alCambiar={alCambiar} />);

    escribir('abc');

    expect(alCambiar).toHaveBeenLastCalledWith(Number.NaN);
    expect(campo().value).toBe('abc');
  });

  it('vaciar el campo entrega NaN', () => {
    const alCambiar = vi.fn();
    render(<Campo alCambiar={alCambiar} inicial={5} />);

    escribir('');

    expect(alCambiar).toHaveBeenLastCalledWith(Number.NaN);
  });

  it('escribir a medias ("12,") no pisa el texto que la persona va tecleando', () => {
    render(<Campo alCambiar={vi.fn()} />);

    escribir('12,');

    expect(campo().value).toBe('12,');
  });

  it('parte mostrando el valor del formulario, con coma decimal', () => {
    render(<Campo alCambiar={vi.fn()} inicial={12.5} />);

    expect(campo().value).toBe('12,5');
  });

  it('si el formulario cambia el valor por su cuenta (la lectura del OCR), el texto lo sigue', () => {
    render(<Campo alCambiar={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: 'Leer del OCR' }));

    expect(campo().value).toBe('7,5');
  });

  it('es un teclado decimal', () => {
    render(<Campo alCambiar={vi.fn()} />);

    expect(campo().getAttribute('inputmode')).toBe('decimal');
  });

  it('avisa, sin bloquear, cuando lo escrito parece un valor con separador de miles', () => {
    const alCambiar = vi.fn();
    render(<Campo alCambiar={alCambiar} />);

    escribir('2.130');

    expect(screen.getByRole('status').textContent).toBe('Se guardará 2,13. Si querías 2130, escribilo sin punto ni coma.');
    expect(alCambiar).toHaveBeenLastCalledWith(2.13);
  });

  it('el aviso se va al escribir otro valor', () => {
    render(<Campo alCambiar={vi.fn()} />);

    escribir('2.130');
    escribir('2130');

    expect(screen.queryByRole('status')).toBeNull();
  });

  it('un decimal normal no avisa', () => {
    render(<Campo alCambiar={vi.fn()} />);

    escribir('2.13');

    expect(screen.queryByRole('status')).toBeNull();
  });
});
