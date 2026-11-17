import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';

import { filaPizarra } from './fixtures';
import { MantencionARealizarModal } from './MantencionARealizarModal';

afterEach(cleanup);

describe('MantencionARealizarModal', () => {
  it('sin lectura dice por qué no hay próxima, no que la pauta esté vacía', () => {
    render(
      <MantencionARealizarModal
        fila={filaPizarra({ counter: null, nextMilestone: null, dueAt: null, remaining: null, interval: null })}
        onClose={() => {}}
      />,
    );

    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText('Sin lectura: no se puede calcular la próxima mantención.')).toBeTruthy();
    expect(within(dialog).queryByText(/no tiene operaciones marcadas/)).toBeNull();
  });

  it('con lectura y un hito sin operaciones lo sigue diciendo', () => {
    render(<MantencionARealizarModal fila={filaPizarra({ items: [] })} onClose={() => {}} />);

    expect(
      within(screen.getByRole('dialog')).getByText('La pauta no tiene operaciones marcadas para este hito.'),
    ).toBeTruthy();
  });
});
