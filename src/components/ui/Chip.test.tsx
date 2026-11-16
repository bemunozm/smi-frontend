import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';

import { Chip, type ChipColor } from './Chip';

afterEach(() => {
  cleanup();
});

function Fila({ estado }: { estado: ChipColor }) {
  return (
    <div>
      <Chip color="danger" size="sm" variant="soft">
        Crítica
      </Chip>
      <Chip color={estado} size="sm" variant="soft">
        Estado
      </Chip>
    </div>
  );
}

describe('Chip', () => {
  it('arma las mismas clases que el Chip de HeroUI', () => {
    render(
      <Chip className="mr-2" color="accent" data-testid="chip" size="sm" variant="soft">
        Abierto
      </Chip>,
    );
    const chip = screen.getByTestId('chip');
    expect(chip.className).toBe('chip chip--accent chip--soft chip--sm mr-2');
    expect(chip.getAttribute('data-slot')).toBe('chip');
    // Texto suelto va envuelto en el label, igual que en HeroUI.
    expect(screen.getByText('Abierto').className).toBe('chip__label');
  });

  it('sin props usa los defaults de HeroUI (default + secondary, sin tamaño)', () => {
    render(<Chip data-testid="chip">Hola</Chip>);
    expect(screen.getByTestId('chip').className).toBe('chip chip--default chip--secondary');
  });

  it('un chip que no cambia conserva su color cuando otro de la página sí cambia', () => {
    // El bug de HeroUI 3.2.3: al recalcular un chip, los demás tomaban su color.
    const { rerender } = render(<Fila estado="accent" />);
    rerender(<Fila estado="success" />);
    expect(screen.getByText('Crítica').parentElement?.className).toContain('chip--danger');
    expect(screen.getByText('Estado').parentElement?.className).toContain('chip--success');
  });
});
