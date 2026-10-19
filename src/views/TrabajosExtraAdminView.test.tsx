import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, cleanup, screen, fireEvent, within } from '@testing-library/react';

import type { TrabajoExtraordinario } from '../types/trabajosExtra';

const { listHook } = vi.hoisted(() => ({ listHook: vi.fn() }));

vi.mock('../hooks/useTrabajosExtra', () => ({
  useTrabajosExtraList: () => listHook(),
}));

import { TrabajosExtraAdminView } from './TrabajosExtraAdminView';

const trabajo = (over: Partial<TrabajoExtraordinario> & Pick<TrabajoExtraordinario, 'id'>): TrabajoExtraordinario => ({
  equipoId: 'e1',
  operatorId: null,
  operador: 'P. Rojas',
  faena: 'Mina Caleta',
  turno: 'DIURNO',
  horometroInicial: 100,
  horometroFinal: 103,
  totalHoras: 3,
  actividades: ['LIMPIEZA_CANCHA'],
  otraActividad: null,
  descripcion: 'Limpieza de la cancha norte',
  observaciones: null,
  fecha: '2026-10-14T15:00:00.000Z',
  equipo: { internalCode: 'CG-002' },
  ...over,
});

const LISTA: TrabajoExtraordinario[] = [
  trabajo({ id: 't1' }),
  trabajo({
    id: 't2',
    equipoId: 'e2',
    equipo: { internalCode: 'EX-001' },
    turno: 'NOCTURNO',
    totalHoras: 2.5,
    fecha: '2026-10-16T22:00:00.000Z',
    actividades: ['OTRO'],
    otraActividad: 'Rescate de camión',
    observaciones: 'Con apoyo del cargador',
  }),
  trabajo({ id: 't3', totalHoras: 4, fecha: '2026-10-10T09:00:00.000Z' }),
];

const ok = (data: TrabajoExtraordinario[]) => ({ data, isPending: false, isError: false, error: null });

beforeEach(() => {
  listHook.mockReturnValue(ok(LISTA));
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('TrabajosExtraAdminView', () => {
  it('lista todos los trabajos (más reciente primero) y el total filtrado suma sus HM', () => {
    render(<TrabajosExtraAdminView />);
    const filas = screen.getAllByTestId(/trabajo-fila-/);
    expect(filas.map((f) => f.getAttribute('data-testid'))).toEqual([
      'trabajo-fila-t2',
      'trabajo-fila-t1',
      'trabajo-fila-t3',
    ]);
    expect(screen.getByTestId('total-filtrado').textContent).toBe('9,5 h en 3 trabajos');
    // «Otro» muestra el texto libre en vez del valor crudo.
    expect(screen.getByText('Otro: Rescate de camión')).toBeTruthy();
  });

  it('filtra por equipo, por turno y por rango de fechas, y el total sigue al filtro', () => {
    render(<TrabajosExtraAdminView />);

    fireEvent.change(screen.getByLabelText(/equipo/i), { target: { value: 'e2' } });
    expect(screen.getAllByTestId(/trabajo-fila-/)).toHaveLength(1);
    expect(screen.getByTestId('trabajo-fila-t2')).toBeTruthy();
    expect(screen.getByTestId('total-filtrado').textContent).toBe('2,5 h en 1 trabajo');

    fireEvent.change(screen.getByLabelText(/equipo/i), { target: { value: 'TODOS' } });
    fireEvent.change(screen.getByLabelText(/turno/i), { target: { value: 'NOCTURNO' } });
    expect(screen.getAllByTestId(/trabajo-fila-/)).toHaveLength(1);
    expect(screen.getByTestId('trabajo-fila-t2')).toBeTruthy();

    fireEvent.change(screen.getByLabelText(/turno/i), { target: { value: 'TODOS' } });
    // t3 es del 10-oct; t1 del 14-oct; t2 del 16-oct (hora local de los mocks).
    fireEvent.change(screen.getByLabelText(/desde/i), { target: { value: '2026-10-13' } });
    fireEvent.change(screen.getByLabelText(/hasta/i), { target: { value: '2026-10-15' } });
    expect(screen.getAllByTestId(/trabajo-fila-/)).toHaveLength(1);
    expect(screen.getByTestId('trabajo-fila-t1')).toBeTruthy();
  });

  it('ningún calce con el filtro muestra el vacío sin romper', () => {
    render(<TrabajosExtraAdminView />);
    fireEvent.change(screen.getByLabelText(/desde/i), { target: { value: '2030-01-01' } });
    expect(screen.queryAllByTestId(/trabajo-fila-/)).toHaveLength(0);
    expect(screen.getByText('Ningún trabajo calza con el filtro.')).toBeTruthy();
    expect(screen.getByTestId('total-filtrado').textContent).toBe('0 h en 0 trabajos');
  });

  it('clic en una fila abre el detalle completo en un popup', () => {
    render(<TrabajosExtraAdminView />);
    fireEvent.click(screen.getByTestId('trabajo-fila-t2'));
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText('Trabajo extraordinario · EX-001')).toBeTruthy();
    expect(within(dialog).getByText('P. Rojas')).toBeTruthy();
    expect(within(dialog).getByText('Nocturno')).toBeTruthy();
    expect(within(dialog).getByText('Otro: Rescate de camión')).toBeTruthy();
    expect(within(dialog).getByText('Con apoyo del cargador')).toBeTruthy();
    expect(within(dialog).getByText('2,5 h')).toBeTruthy();
  });

  it('muestra el error del listado', () => {
    listHook.mockReturnValue({ data: undefined, isPending: false, isError: true, error: new Error('Falló Terreno') });
    render(<TrabajosExtraAdminView />);
    expect(screen.getByText('Falló Terreno')).toBeTruthy();
  });
});
