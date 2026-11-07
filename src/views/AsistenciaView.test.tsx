import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, cleanup, screen, fireEvent, within } from '@testing-library/react';

import type { AsistenciaMes } from '../types/asistencia';

const { asistenciaHook, mesesPedidos } = vi.hoisted(() => ({
  asistenciaHook: vi.fn(),
  mesesPedidos: [] as string[],
}));

vi.mock('../hooks/useAsistencia', () => ({
  useAsistencia: (mes: string) => {
    mesesPedidos.push(mes);
    return asistenciaHook(mes);
  },
}));

import { AsistenciaView } from './AsistenciaView';

const DATA: AsistenciaMes = {
  mes: '2026-11',
  dias: 30,
  personas: [
    { id: 's1', nombre: 'Ana Soto', tipo: 'SUPERVISOR', dias: [1, 2, 6], total: 3 },
    { id: 's2', nombre: 'Juan Pérez', tipo: 'SUPERVISOR', dias: [], total: 0 },
    { id: 'o1', nombre: 'Luis Díaz', tipo: 'OPERADOR', dias: [2], total: 1 },
    { id: 'o2', nombre: 'Pedro Rojas', tipo: 'OPERADOR', dias: [30], total: 1 },
  ],
};

const ok = (data: AsistenciaMes) => ({ data, isPending: false, isError: false, error: null });

beforeEach(() => {
  mesesPedidos.length = 0;
  asistenciaHook.mockReturnValue(ok(DATA));
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('AsistenciaView', () => {
  it('pinta una X exactamente en los días que vienen y el total por fila', () => {
    render(<AsistenciaView />);

    expect(within(screen.getByTestId('fila-s1')).getAllByText('X')).toHaveLength(3);
    expect(screen.getByTestId('total-s1').textContent).toBe('3');

    expect(within(screen.getByTestId('fila-s2')).queryAllByText('X')).toHaveLength(0);
    expect(screen.getByTestId('total-s2').textContent).toBe('0');

    // El último día del mes también pinta (borde de la grilla).
    expect(within(screen.getByTestId('fila-o2')).getAllByText('X')).toHaveLength(1);
  });

  it('supervisores primero y operadores después, cada grupo con su encabezado', () => {
    render(<AsistenciaView />);

    expect(screen.getByText('Supervisores')).toBeTruthy();
    expect(screen.getByText('Operadores')).toBeTruthy();
    const ids = screen.getAllByTestId(/^fila-/).map((f) => f.getAttribute('data-testid'));
    expect(ids).toEqual(['fila-s1', 'fila-s2', 'fila-o1', 'fila-o2']);
  });

  it('el filtro Solo supervisores / Solo operadores esconde al otro grupo', async () => {
    render(<AsistenciaView />);

    fireEvent.click(screen.getByRole('button', { name: /Mostrar/ }));
    fireEvent.click(await screen.findByRole('option', { name: 'Solo supervisores' }));
    expect(screen.getAllByTestId(/^fila-/).map((f) => f.getAttribute('data-testid'))).toEqual([
      'fila-s1',
      'fila-s2',
    ]);
    expect(screen.queryByText('Operadores')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: /Mostrar/ }));
    fireEvent.click(await screen.findByRole('option', { name: 'Solo operadores' }));
    expect(screen.getAllByTestId(/^fila-/).map((f) => f.getAttribute('data-testid'))).toEqual([
      'fila-o1',
      'fila-o2',
    ]);
  });

  it('cambiar de mes pide ese mes al hook y actualiza el título', () => {
    render(<AsistenciaView />);

    // Parte en el mes actual (noviembre de 2026 al momento de escribir esto).
    const ahora = new Date();
    const mesActual = `${ahora.getFullYear()}-${String(ahora.getMonth() + 1).padStart(2, '0')}`;
    expect(mesesPedidos[0]).toBe(mesActual);

    fireEvent.click(screen.getByRole('button', { name: 'Mes anterior' }));
    const anterior = new Date(ahora.getFullYear(), ahora.getMonth() - 1, 15);
    const mesAnterior = `${anterior.getFullYear()}-${String(anterior.getMonth() + 1).padStart(2, '0')}`;
    expect(mesesPedidos).toContain(mesAnterior);

    const titulo = new Intl.DateTimeFormat('es-CL', { month: 'long', year: 'numeric' }).format(anterior);
    expect(screen.getByText(titulo, { exact: false })).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Mes siguiente' }));
    expect(mesesPedidos).toContain(mesActual);
  });

  it('el header trae tantas columnas de día como diga el backend (más nombre y total)', () => {
    render(<AsistenciaView />);
    const encabezado = screen.getByTestId('encabezado-dias');
    // nombre + 30 días + total
    expect(encabezado.querySelectorAll('th')).toHaveLength(32);
    expect(within(encabezado).getByText('30')).toBeTruthy();
    expect(within(encabezado).getByText('Total')).toBeTruthy();
  });

  it('estados: cargando sin filas; error con role=alert; sin personas lo dice', () => {
    asistenciaHook.mockReturnValue({ data: undefined, isPending: true, isError: false, error: null });
    render(<AsistenciaView />);
    expect(screen.queryAllByTestId(/^fila-/)).toHaveLength(0);
    cleanup();

    asistenciaHook.mockReturnValue({
      data: undefined,
      isPending: false,
      isError: true,
      error: new Error('Falló la asistencia'),
    });
    render(<AsistenciaView />);
    expect(screen.getByRole('alert').textContent).toBe('Falló la asistencia');
    cleanup();

    asistenciaHook.mockReturnValue(ok({ mes: '2026-11', dias: 30, personas: [] }));
    render(<AsistenciaView />);
    expect(screen.getByText('Sin registros este mes.')).toBeTruthy();
  });
});
