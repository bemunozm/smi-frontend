import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, cleanup, screen, fireEvent, within } from '@testing-library/react';

import type { ActivityFeed } from '../types/activity-log';

const { activityHook, rangosPedidos } = vi.hoisted(() => ({
  activityHook: vi.fn(),
  rangosPedidos: [] as Array<{ from: string; to: string }>,
}));

vi.mock('../hooks/useActivityLog', () => ({
  useActivityLog: (from: string, to: string) => {
    rangosPedidos.push({ from, to });
    return activityHook(from, to);
  },
}));

// La tabla de escritorio por defecto; el branch móvil se prueba aparte abajo.
const { mediaQueryHook } = vi.hoisted(() => ({ mediaQueryHook: vi.fn(() => true) }));
vi.mock('../hooks/useMediaQuery', () => ({
  DESKTOP_QUERY: '(min-width: 1024px)',
  useMediaQuery: () => mediaQueryHook(),
}));

import { ActivityLogView } from './ActivityLogView';

const DATA: ActivityFeed = {
  from: '2026-11-06',
  to: '2026-11-12',
  events: [
    {
      id: 'fuel:created:c1',
      kind: 'FUEL_LOAD',
      action: 'CREATED',
      occurredAt: '2026-11-12T14:00:00.000Z',
      dataDate: '2026-11-08',
      backdated: true,
      actorName: 'Juan Pérez',
      summary: 'CAM-31 · 120 L petróleo · manual',
      changes: null,
    },
    {
      id: 'card:closed:rh1',
      kind: 'SHIFT_CARD',
      action: 'CLOSED',
      occurredAt: '2026-11-12T12:00:00.000Z',
      dataDate: '2026-11-12',
      backdated: false,
      actorName: 'Ana Soto',
      summary: 'WA470 · Pedro Rojas · turno día',
      changes: null,
    },
    {
      id: 'log:cl1',
      kind: 'EXTRA_WORK',
      action: 'UPDATED',
      occurredAt: '2026-11-11T18:00:00.000Z',
      dataDate: null,
      backdated: false,
      actorName: 'Ana Soto',
      summary: 'Report · 1 dato',
      changes: [{ field: 'horas', label: 'Total de horas', before: '4', after: '5,5' }],
    },
    {
      id: 'log:cl2',
      kind: 'FINDING',
      action: 'DELETED',
      occurredAt: '2026-11-10T18:00:00.000Z',
      dataDate: null,
      backdated: false,
      actorName: 'Admin SMI',
      summary: 'Hallazgo · 2 datos',
      changes: [
        { field: 'equipo', label: 'Equipo', before: 'CA-011', after: '—' },
        { field: 'descripción', label: 'Descripción', before: 'Fuga de aceite', after: '—' },
      ],
    },
  ],
};

const ok = (data: ActivityFeed) => ({ data, isPending: false, isError: false, error: null });

beforeEach(() => {
  rangosPedidos.length = 0;
  activityHook.mockReturnValue(ok(DATA));
  mediaQueryHook.mockReturnValue(true);
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const filas = () => screen.getAllByTestId(/^evento-fila-/).map((f) => f.getAttribute('data-testid'));

describe('ActivityLogView', () => {
  it('pide los últimos 7 días por defecto (día local, inclusive)', () => {
    render(<ActivityLogView />);

    const [rango] = rangosPedidos;
    const pad = (n: number) => String(n).padStart(2, '0');
    const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    expect(rango.to).toBe(ymd(new Date()));
    expect(rango.from).toBe(ymd(new Date(Date.now() - 6 * 24 * 60 * 60 * 1000)));
  });

  it('lista los eventos en el orden del backend, con acción, módulo y detalle', () => {
    render(<ActivityLogView />);

    expect(filas()).toEqual([
      'evento-fila-fuel:created:c1',
      'evento-fila-card:closed:rh1',
      'evento-fila-log:cl1',
      'evento-fila-log:cl2',
    ]);
    const fila = screen.getByTestId('evento-fila-fuel:created:c1');
    expect(within(fila).getByText('Creación')).toBeTruthy();
    expect(within(fila).getByText('Carga de combustible')).toBeTruthy();
    expect(within(fila).getByText('CAM-31 · 120 L petróleo · manual')).toBeTruthy();
    expect(screen.getByTestId('total-acciones').textContent).toBe('4 acciones');
  });

  it('un evento retroactivo muestra además el día al que corresponde, y el contador los suma', () => {
    render(<ActivityLogView />);

    const fila = screen.getByTestId('evento-fila-fuel:created:c1');
    expect(within(fila).getByText('corresponde al 08/11/2026')).toBeTruthy();
    expect(screen.getByTestId('total-retroactivos').textContent).toBe('1 retroactiva');

    // Los del mismo día no repiten la segunda fecha.
    expect(within(screen.getByTestId('evento-fila-card:closed:rh1')).queryByText(/corresponde al/)).toBeNull();
  });

  it('el filtro por acción deja solo esa acción (y el contador sigue al filtro)', async () => {
    render(<ActivityLogView />);

    fireEvent.click(screen.getByRole('button', { name: /Acción/ }));
    fireEvent.click(await screen.findByRole('option', { name: 'Edición' }));

    expect(filas()).toEqual(['evento-fila-log:cl1']);
    expect(screen.getByTestId('total-acciones').textContent).toBe('1 acción');
  });

  it('el filtro por módulo y por usuario se combinan', async () => {
    render(<ActivityLogView />);

    fireEvent.click(screen.getByRole('button', { name: /Módulo/ }));
    fireEvent.click(await screen.findByRole('option', { name: 'Tarjeta de turno' }));
    expect(filas()).toEqual(['evento-fila-card:closed:rh1']);

    fireEvent.click(screen.getByRole('button', { name: /Usuario/ }));
    fireEvent.click(await screen.findByRole('option', { name: 'Juan Pérez' }));
    expect(screen.queryAllByTestId(/^evento-fila-/)).toHaveLength(0);
    expect(screen.getByText('Ninguna actividad calza con el filtro.')).toBeTruthy();
  });

  it('abrir una eliminación muestra el antes → después de lo borrado', async () => {
    render(<ActivityLogView />);

    fireEvent.click(screen.getByTestId('evento-fila-log:cl2'));

    const modal = await screen.findByRole('dialog');
    expect(within(modal).getByText('Eliminación · Hallazgo')).toBeTruthy();
    expect(within(modal).getByText('Qué cambió')).toBeTruthy();
    expect(within(modal).getByText(/Fuga de aceite/)).toBeTruthy();
  });

  it('en pantalla angosta pinta tarjetas en vez de tabla, con los mismos eventos', () => {
    mediaQueryHook.mockReturnValue(false);
    render(<ActivityLogView />);

    expect(screen.queryByRole('grid')).toBeNull();
    expect(filas()).toHaveLength(4);
  });

  it('estados: cargando sin filas; error con role=alert; sin eventos lo dice', () => {
    activityHook.mockReturnValue({ data: undefined, isPending: true, isError: false, error: null });
    render(<ActivityLogView />);
    expect(screen.queryAllByTestId(/^evento-fila-/)).toHaveLength(0);
    cleanup();

    activityHook.mockReturnValue({
      data: undefined,
      isPending: false,
      isError: true,
      error: new Error('Falló el registro'),
    });
    render(<ActivityLogView />);
    expect(screen.getByRole('alert').textContent).toBe('Falló el registro');
    cleanup();

    activityHook.mockReturnValue(ok({ from: '2026-11-06', to: '2026-11-12', events: [] }));
    render(<ActivityLogView />);
    expect(screen.getByText('Sin actividad en el período.')).toBeTruthy();
  });
});
