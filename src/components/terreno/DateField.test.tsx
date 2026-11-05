import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { DateField } from './DateField';

afterEach(cleanup);

/** Reloj fijo: miércoles 2026-11-04 a mediodía. */
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 10, 4, 12, 0));
});
afterEach(() => vi.useRealTimers());

function renderField(
  props: Partial<{ value: string; min: string; max: string; onChange: (v: string) => void }> = {},
) {
  const onChange = props.onChange ?? vi.fn();
  render(
    <DateField
      label="Fecha del reporte"
      value={props.value ?? '2026-11-04'}
      onChange={onChange}
      min={props.min ?? '2026-10-05'}
      max={props.max ?? '2026-11-04'}
    />,
  );
  return { onChange };
}

const abrir = () => fireEvent.click(screen.getByRole('button', { name: 'Fecha del reporte' }));

describe('DateField', () => {
  it('muestra la fecha elegida en formato legible es-CL en el gatillo', () => {
    renderField({ value: '2026-11-03' });

    const gatillo = screen.getByRole('button', { name: 'Fecha del reporte' });
    expect(gatillo.textContent).toMatch(/mar(tes)?\.? 03-11-2026/i);
  });

  it('abre el calendario del mes de la fecha elegida y elegir un día dispara onChange', () => {
    const { onChange } = renderField({ value: '2026-11-04' });

    abrir();
    expect(screen.getByText(/noviembre de 2026/i)).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /martes,? 3 de noviembre/i }));
    expect(onChange).toHaveBeenCalledWith('2026-11-03');
  });

  it('los días fuera de la ventana min/max quedan deshabilitados', () => {
    renderField({ min: '2026-11-02', max: '2026-11-04' });

    abrir();
    const d1 = screen.getByRole('button', { name: /domingo,? 1 de noviembre/i }) as HTMLButtonElement;
    const d2 = screen.getByRole('button', { name: /lunes,? 2 de noviembre/i }) as HTMLButtonElement;
    expect(d1.disabled).toBe(true);
    expect(d2.disabled).toBe(false);
  });

  it('"Ayer" elige el día anterior sin abrir el mes', () => {
    const { onChange } = renderField();

    abrir();
    fireEvent.click(screen.getByRole('button', { name: 'Ayer' }));
    expect(onChange).toHaveBeenCalledWith('2026-11-03');
  });

  it('la navegación de mes no pasa de la ventana', () => {
    renderField({ min: '2026-10-05', max: '2026-11-04' });

    abrir();
    const anterior = screen.getByRole('button', { name: 'Mes anterior' }) as HTMLButtonElement;
    const siguiente = screen.getByRole('button', { name: 'Mes siguiente' }) as HTMLButtonElement;
    expect(siguiente.disabled).toBe(true); // max es este mes

    fireEvent.click(anterior);
    expect(screen.getByText(/octubre de 2026/i)).toBeTruthy();
    expect((screen.getByRole('button', { name: 'Mes anterior' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('elegir un día cierra el panel y lo deja accesible con aria-expanded', () => {
    renderField();

    const gatillo = screen.getByRole('button', { name: 'Fecha del reporte' });
    expect(gatillo.getAttribute('aria-expanded')).toBe('false');
    abrir();
    expect(gatillo.getAttribute('aria-expanded')).toBe('true');

    fireEvent.click(screen.getByRole('button', { name: /lunes,? 2 de noviembre/i }));
    expect(gatillo.getAttribute('aria-expanded')).toBe('false');
  });
});
