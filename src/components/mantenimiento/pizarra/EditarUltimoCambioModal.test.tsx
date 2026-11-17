import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';

const { mutate } = vi.hoisted(() => ({ mutate: vi.fn() }));
vi.mock('../../../hooks/useMaintenancePlans', () => ({
  useCorregirUltimoCambio: () => ({ mutate, isPending: false }),
}));

import { EditarUltimoCambioModal } from './EditarUltimoCambioModal';
import { filaPizarra } from './fixtures';

const guardar = () => screen.getByRole('button', { name: 'Guardar cambios' }) as HTMLButtonElement;
const campoLectura = (nombre: RegExp) => screen.getByRole('textbox', { name: nombre }) as HTMLInputElement;

/** Reloj fijo: 20-10-2026, así el calendario abre en octubre y el 25 es futuro. */
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 9, 20, 12, 0));
});

afterEach(() => {
  vi.useRealTimers();
  cleanup();
  mutate.mockReset();
});

describe('EditarUltimoCambioModal', () => {
  it('abre con la fecha y el horómetro actuales, el equipo y el hito como referencia', () => {
    render(<EditarUltimoCambioModal fila={filaPizarra()} onClose={() => {}} />);

    expect(screen.getByRole('heading', { name: 'Editar último cambio' })).toBeTruthy();
    expect(screen.getByText('SEM 02')).toBeTruthy();
    expect(screen.getByText('Mantención de 250 h')).toBeTruthy();
    expect(screen.getByRole('button', { name: /01\/10\/2026/ })).toBeTruthy();
    expect(campoLectura(/Horómetro del último cambio/).value).toBe('2250');
    // Sin cambios no hay nada que guardar.
    expect(guardar().disabled).toBe(true);
  });

  it('acepta coma decimal y manda la fecha y la lectura juntas; al confirmarse se cierra', async () => {
    const onClose = vi.fn();
    render(<EditarUltimoCambioModal fila={filaPizarra()} onClose={onClose} />);

    fireEvent.change(campoLectura(/Horómetro del último cambio/), { target: { value: '2260,5' } });
    fireEvent.click(screen.getByRole('button', { name: /01\/10\/2026/ }));
    fireEvent.click(await screen.findByRole('button', { name: /October 2, 2026/ }));
    expect(guardar().disabled).toBe(false);
    fireEvent.click(guardar());

    const [vars, opciones] = mutate.mock.calls[0] as [Record<string, unknown>, { onSuccess: () => void }];
    expect(vars).toEqual({ equipmentId: 'e1', internalCode: 'SEM 02', doneAt: '2026-10-02', counterAt: 2260.5 });
    opciones.onSuccess();
    expect(onClose).toHaveBeenCalled();
  });

  it('no guarda con la lectura vacía, inválida o fuera de rango', () => {
    render(<EditarUltimoCambioModal fila={filaPizarra()} onClose={() => {}} />);

    for (const valor of ['', 'abc', '2000000']) {
      fireEvent.change(campoLectura(/Horómetro del último cambio/), { target: { value: valor } });
      expect(guardar().disabled).toBe(true);
    }
    expect(mutate).not.toHaveBeenCalled();
  });

  it('los días futuros no se pueden elegir', async () => {
    render(<EditarUltimoCambioModal fila={filaPizarra()} onClose={() => {}} />);

    fireEvent.click(screen.getByRole('button', { name: /01\/10\/2026/ }));
    const futuro = await screen.findByRole('button', { name: /October 25, 2026/ });
    expect(futuro.getAttribute('aria-disabled')).toBe('true');
  });

  it('un liviano habla en km y del servicio', () => {
    const fila = filaPizarra({
      equipmentClass: 'LIGHT',
      unit: 'km',
      source: 'LIVIANO',
      internalCode: 'CAM 07',
      lastChange: { milestone: 10000, counterAt: 80000, doneAt: '2026-09-01T12:00:00.000Z' },
    });
    render(<EditarUltimoCambioModal fila={fila} onClose={() => {}} />);

    expect(screen.getByText('Servicio de 10.000 km')).toBeTruthy();
    expect(campoLectura(/Km del último cambio/).value).toBe('80000');
  });
});
