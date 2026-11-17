import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';

const { mutate } = vi.hoisted(() => ({ mutate: vi.fn() }));
vi.mock('../../../hooks/useMaintenancePlans', () => ({
  useCorregirUltimoCambio: () => ({ mutate, isPending: false }),
}));

import { EditarUltimoCambioModal } from './EditarUltimoCambioModal';
import { filaPizarra, ultimoCambio } from './fixtures';

const guardar = () => screen.getByRole('button', { name: 'Guardar cambios' }) as HTMLButtonElement;
const campoLectura = (nombre: RegExp) => screen.getByRole('textbox', { name: nombre }) as HTMLInputElement;
const campo = (name: string) => document.querySelector(`[name="${name}"]`) as HTMLInputElement | HTMLTextAreaElement;
const disparador = (testid: string) => document.querySelector(`[data-testid="${testid}"] button`) as HTMLButtonElement;

function escribir(name: string, valor: string) {
  fireEvent.change(campo(name), { target: { value: valor } });
}

async function elegir(testid: string, opcion: RegExp) {
  fireEvent.click(disparador(testid));
  fireEvent.click(await waitFor(() => screen.getByRole('option', { name: opcion })));
}

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
  it('abre con todos los campos del último cambio precargados', () => {
    render(<EditarUltimoCambioModal fila={filaPizarra()} onClose={() => {}} />);

    expect(screen.getByRole('heading', { name: 'Editar último cambio' })).toBeTruthy();
    expect(screen.getByText('SEM 02')).toBeTruthy();
    expect(screen.getByRole('button', { name: /01\/10\/2026/ })).toBeTruthy();
    expect(disparador('select-tipo').textContent).toContain('Preventiva');
    expect(disparador('select-mantencion').textContent).toContain('250 h');
    expect(campo('titulo').value).toBe('Mantención 250 h');
    expect(campo('realizadaPor').value).toBe('Taller Norte');
    expect(campoLectura(/Horómetro en la mantención/).value).toBe('2250');
    expect(campo('observaciones').value).toBe('Sin novedad');
    // Todo editable en una mantención anterior.
    expect(disparador('select-tipo').disabled).toBe(false);
    expect(campo('titulo').disabled).toBe(false);
    // Sin cambios no hay nada que guardar.
    expect(guardar().disabled).toBe(true);
  });

  it('manda todos los campos editables; acepta coma decimal y al confirmarse se cierra', async () => {
    const onClose = vi.fn();
    render(<EditarUltimoCambioModal fila={filaPizarra()} onClose={onClose} />);

    fireEvent.change(campoLectura(/Horómetro en la mantención/), { target: { value: '2260,5' } });
    fireEvent.click(screen.getByRole('button', { name: /01\/10\/2026/ }));
    fireEvent.click(await screen.findByRole('button', { name: /October 2, 2026/ }));
    await elegir('select-mantencion', /^500 h$/);
    escribir('titulo', '  Mantención 500 h  ');
    escribir('realizadaPor', '');
    escribir('observaciones', 'Cambio de filtros');
    expect(guardar().disabled).toBe(false);
    fireEvent.click(guardar());

    const [vars, opciones] = mutate.mock.calls[0] as [Record<string, unknown>, { onSuccess: () => void }];
    expect(vars).toEqual({
      equipmentId: 'e1',
      internalCode: 'SEM 02',
      doneAt: '2026-10-02',
      counterAt: 2260.5,
      milestone: 500,
      tipo: 'PREVENTIVA',
      titulo: 'Mantención 500 h',
      realizadaPor: '',
      observaciones: 'Cambio de filtros',
    });
    opciones.onSuccess();
    expect(onClose).toHaveBeenCalled();
  });

  it('el título no puede quedar en blanco', () => {
    render(<EditarUltimoCambioModal fila={filaPizarra()} onClose={() => {}} />);

    escribir('titulo', '   ');
    expect(guardar().disabled).toBe(true);
  });

  it('sin orden asociada: solo fecha, lectura e hito; no manda los datos de la orden', () => {
    const fila = filaPizarra({
      lastChange: ultimoCambio({ ordenId: null, tipo: null, titulo: null, realizadaPor: null, observaciones: null }),
    });
    render(<EditarUltimoCambioModal fila={fila} onClose={() => {}} />);

    expect(screen.getByText(/solo se pueden corregir fecha, lectura e hito\./)).toBeTruthy();
    expect(disparador('select-tipo').disabled).toBe(true);
    expect(campo('titulo').disabled).toBe(true);
    expect(campo('realizadaPor').disabled).toBe(true);
    expect(campo('observaciones').disabled).toBe(true);
    expect(disparador('select-mantencion').disabled).toBe(false);

    fireEvent.change(campoLectura(/Horómetro en la mantención/), { target: { value: '2255' } });
    fireEvent.click(guardar());
    expect(mutate.mock.calls[0][0]).toEqual({
      equipmentId: 'e1',
      internalCode: 'SEM 02',
      doneAt: '2026-10-01',
      counterAt: 2255,
      milestone: 250,
    });
  });

  it('OT del taller: solo el título entre los datos de la orden, y el hito no se toca', () => {
    const fila = filaPizarra({ lastChange: ultimoCambio({ historica: false }) });
    render(<EditarUltimoCambioModal fila={fila} onClose={() => {}} />);

    expect(screen.getByText(/Viene de una orden del taller/)).toBeTruthy();
    expect(campo('titulo').disabled).toBe(false);
    expect(disparador('select-tipo').disabled).toBe(true);
    expect(campo('realizadaPor').disabled).toBe(true);
    expect(campo('observaciones').disabled).toBe(true);
    expect(disparador('select-mantencion').disabled).toBe(true);

    escribir('titulo', 'Mantención 250 h motor');
    fireEvent.click(guardar());
    expect(mutate.mock.calls[0][0]).toEqual({
      equipmentId: 'e1',
      internalCode: 'SEM 02',
      doneAt: '2026-10-01',
      counterAt: 2250,
      titulo: 'Mantención 250 h motor',
    });
  });

  it('pasar a correctiva pide confirmación antes de guardar', async () => {
    render(<EditarUltimoCambioModal fila={filaPizarra()} onClose={() => {}} />);

    await elegir('select-tipo', /^Correctiva$/);
    fireEvent.click(guardar());
    expect(mutate).not.toHaveBeenCalled();
    expect(screen.getByRole('alert').textContent).toMatch(/dejará de contar como último cambio/);

    fireEvent.click(screen.getByRole('button', { name: 'Sí, guardar como correctiva' }));
    expect(mutate.mock.calls[0][0]).toMatchObject({ tipo: 'CORRECTIVA' });
  });

  it('no guarda con la lectura vacía, inválida o fuera de rango', () => {
    render(<EditarUltimoCambioModal fila={filaPizarra()} onClose={() => {}} />);

    for (const valor of ['', 'abc', '2000000']) {
      fireEvent.change(campoLectura(/Horómetro en la mantención/), { target: { value: valor } });
      expect(guardar().disabled).toBe(true);
    }
    expect(mutate).not.toHaveBeenCalled();
  });

  it('el calendario abre en el mes de la fecha precargada y la deja marcada', async () => {
    const fila = filaPizarra({ lastChange: ultimoCambio({ doneAt: '2026-09-03T12:00:00.000Z' }) });
    render(<EditarUltimoCambioModal fila={fila} onClose={() => {}} />);

    fireEvent.click(screen.getByRole('button', { name: /03\/09\/2026/ }));
    const dia = await screen.findByRole('button', { name: /September 3, 2026/ });
    expect(dia.closest('[role="gridcell"]')?.getAttribute('aria-selected')).toBe('true');
    // Septiembre, no el mes de hoy (octubre en el reloj del test).
    expect(screen.queryByRole('button', { name: /October 20, 2026/ })).toBeNull();
  });

  it('los días futuros no se pueden elegir', async () => {
    render(<EditarUltimoCambioModal fila={filaPizarra()} onClose={() => {}} />);

    fireEvent.click(screen.getByRole('button', { name: /01\/10\/2026/ }));
    const futuro = await screen.findByRole('button', { name: /October 25, 2026/ });
    expect(futuro.getAttribute('aria-disabled')).toBe('true');
  });

  it('sin orden y sin hito que elegir, la nota habla solo de fecha y lectura', () => {
    const fila = filaPizarra({
      unit: 'km',
      source: 'LIVIANO',
      lastChange: ultimoCambio({ ordenId: null, tipo: null, titulo: null, realizadaPor: null, observaciones: null }),
    });
    render(<EditarUltimoCambioModal fila={fila} onClose={() => {}} />);

    expect(screen.getByText(/no tiene una orden asociada: solo se pueden corregir fecha y lectura\./)).toBeTruthy();
  });

  it('un liviano sin pauta habla en km y del servicio, sin elegir hito', () => {
    const fila = filaPizarra({
      equipmentClass: 'LIGHT',
      unit: 'km',
      source: 'LIVIANO',
      internalCode: 'CAM 07',
      lastChange: ultimoCambio({ milestone: 10000, counterAt: 80000, doneAt: '2026-09-01T12:00:00.000Z' }),
    });
    render(<EditarUltimoCambioModal fila={fila} onClose={() => {}} />);

    expect(screen.getByText('Servicio de 10.000 km')).toBeTruthy();
    expect(campoLectura(/Kilometraje en la mantención/).value).toBe('80000');
    expect(document.querySelector('[data-testid="select-mantencion"]')).toBeNull();

    fireEvent.change(campoLectura(/Kilometraje en la mantención/), { target: { value: '80100' } });
    fireEvent.click(guardar());
    expect(mutate.mock.calls[0][0]).not.toHaveProperty('milestone');
  });
});
