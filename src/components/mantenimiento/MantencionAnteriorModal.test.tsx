import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';

const mutate = vi.fn();
vi.mock('../../hooks/useOrdenes', () => ({ useRegistrarMantencionHistorica: () => ({ mutate, isPending: false }) }));

import { MantencionAnteriorModal } from './MantencionAnteriorModal';

const EQUIPO = { id: 'eq_1', internalCode: 'SEM 02', controlUnit: 'HOURS' as const };
const PAUTA = { milestones: [250, 500], initialMilestone: 50 };

function abrir(props: Partial<Parameters<typeof MantencionAnteriorModal>[0]> = {}) {
  render(<MantencionAnteriorModal equipo={EQUIPO} isOpen onOpenChange={() => {}} {...props} />);
}

const guardar = () => screen.getByRole('button', { name: 'Registrar mantención' }) as HTMLButtonElement;

function escribir(name: string, valor: string) {
  fireEvent.change(document.querySelector(`input[name="${name}"]`) as HTMLInputElement, { target: { value: valor } });
}

async function elegirMantencion(nombre: RegExp) {
  fireEvent.click(document.querySelector('[data-testid="select-mantencion"] button') as HTMLElement);
  fireEvent.click(await waitFor(() => screen.getByRole('option', { name: nombre })));
}

/** La fecha se elige con el calendario de HeroUI (botón + popover), nunca un
 * `<input type="date">` nativo. jsdom formatea en en-US: «January 10, 2026». */
async function elegirFecha(dia: number) {
  fireEvent.click(screen.getByRole('button', { name: /Elegí la fecha|\d{2}\/\d{2}\/\d{4}/ }));
  const celda = await screen.findByRole('button', { name: new RegExp(`January ${dia}, 2026`) });
  fireEvent.click(celda);
}

/** Reloj fijo: 20-01-2026, así el calendario abre en enero y el 25 es futuro. */
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 0, 20, 12, 0));
});

afterEach(() => {
  vi.useRealTimers();
  cleanup();
  mutate.mockReset();
});

describe('MantencionAnteriorModal', () => {
  it('sin pauta: se guarda con fecha y título, sin lectura ni milestone (comportamiento de la ficha)', async () => {
    abrir();
    expect(screen.getByText('Qué mantención fue')).toBeTruthy();
    expect(guardar().disabled).toBe(true);
    await elegirFecha(10);
    escribir('titulo', 'Cambio de aceite');
    expect(guardar().disabled).toBe(false);
    fireEvent.click(guardar());
    const body = mutate.mock.calls[0][0] as Record<string, unknown>;
    expect(body).toMatchObject({ equipoId: 'eq_1', fecha: '2026-01-10', titulo: 'Cambio de aceite' });
    expect('milestone' in body).toBe(false);
    expect('lectura' in body).toBe(false);
  });

  it('lecturaObligatoria: pide la lectura aunque no haya pauta', async () => {
    abrir({ lecturaObligatoria: true });
    await elegirFecha(10);
    escribir('titulo', 'Cambio de aceite');
    expect(guardar().disabled).toBe(true);
    escribir('lectura', '1250');
    expect(guardar().disabled).toBe(false);
  });

  it('con pauta: no guarda hasta elegir la mantención y la lectura; envía el milestone y rellena el título', async () => {
    abrir({ pauta: PAUTA, lecturaObligatoria: true });
    await elegirFecha(10);
    expect(guardar().disabled).toBe(true);
    await elegirMantencion(/^500 h/);
    expect(guardar().disabled).toBe(true); // falta la lectura
    escribir('lectura', '510,5');
    expect(guardar().disabled).toBe(false);
    fireEvent.click(guardar());
    expect(mutate.mock.calls[0][0]).toMatchObject({
      equipoId: 'eq_1',
      fecha: '2026-01-10',
      titulo: 'Mantención 500 h',
      lectura: 510.5,
      milestone: 500,
    });
  });

  it('con pauta ofrece el servicio inicial y respeta un título ya escrito', async () => {
    abrir({ pauta: PAUTA });
    await elegirFecha(10);
    escribir('titulo', 'Servicio de entrega');
    await elegirMantencion(/Servicio inicial 50 h/);
    escribir('lectura', '55');
    fireEvent.click(guardar());
    expect(mutate.mock.calls[0][0]).toMatchObject({ titulo: 'Servicio de entrega', milestone: 50, lectura: 55 });
  });

  it('en km las opciones salen en km', async () => {
    abrir({ equipo: { ...EQUIPO, controlUnit: 'KM' }, pauta: { milestones: [10000], initialMilestone: null } });
    await elegirMantencion(/^10\.000 km/);
  });

  it('en km el servicio inicial y el título automático también van en km', async () => {
    abrir({ equipo: { ...EQUIPO, controlUnit: 'KM' }, pauta: { milestones: [10000], initialMilestone: 1000 } });
    await elegirFecha(10);
    await elegirMantencion(/Servicio inicial 1\.000 km/);
    escribir('lectura', '1020');
    fireEvent.click(guardar());
    expect(mutate.mock.calls[0][0]).toMatchObject({ titulo: 'Mantención 1.000 km', milestone: 1000 });
  });

  it('la fecha es un botón con calendario (sin input nativo) y no deja elegir un día futuro', async () => {
    abrir();
    expect(document.querySelector('input[type="date"]')).toBeNull();
    escribir('titulo', 'Cambio de aceite');

    fireEvent.click(screen.getByRole('button', { name: /Elegí la fecha/ }));
    const futuro = await screen.findByRole('button', { name: /January 25, 2026/ });
    expect(futuro.getAttribute('aria-disabled')).toBe('true');
    fireEvent.click(futuro);
    // No se eligió nada: el calendario sigue abierto esperando un día válido.
    expect(screen.getByRole('button', { name: /January 25, 2026/ })).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /January 10, 2026/ }));
    // Lo elegido queda a la vista en el botón.
    expect(screen.getByRole('button', { name: /10\/01\/2026/ })).toBeTruthy();
    expect(guardar().disabled).toBe(false);
  });
});
