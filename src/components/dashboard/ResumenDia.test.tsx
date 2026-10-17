import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, cleanup, screen, within, fireEvent } from '@testing-library/react';

const { resumenHook } = vi.hoisted(() => ({ resumenHook: vi.fn() }));

vi.mock('../../hooks/useDashboard', () => ({
  useDashboardResumenDia: (fecha?: string) => resumenHook(fecha),
}));

import { toDateOnly } from '../../lib/turno';
import { ResumenDia } from './ResumenDia';

const BASE = {
  fecha: '2026-10-16',
  hm: { total: 10.5, dia: 6, noche: 4.5 },
  diesel: { total: 120, dia: 40, noche: 60, porHm: 11.43 },
  reports: {
    totalHoras: 9,
    porEquipo: [
      { internalCode: 'EX-001', horas: 4 },
      { internalCode: 'CG-002', horas: 2.5 },
      { internalCode: 'CM-006', horas: 1.5 },
      { internalCode: 'CN-007', horas: 1 },
      { internalCode: 'AA-001', horas: 0 },
    ],
  },
  produccion: { internos: 26, minaCaleta: 48, mineras: 0 },
  adBlue: null,
  operacionPorEquipo: [
    {
      internalCode: 'CG-002',
      dia: { hm: 6, litros: 40 },
      noche: { hm: 4, litros: 30 },
      total: { hm: 10, litros: 80 },
    },
    {
      internalCode: 'EX-001',
      dia: { hm: 0, litros: 0 },
      noche: { hm: 0.5, litros: 60 },
      total: { hm: 0.5, litros: 70 },
    },
  ],
  lecturas: [
    { id: 'c1', internalCode: 'CG-002', turno: 'DIURNO', inicial: 100, final: 106, avance: 6 },
    { id: 'c2', internalCode: 'CG-002', turno: 'NOCTURNO', inicial: 106, final: null, avance: null },
  ],
};

const mock = (data: object) =>
  resumenHook.mockReturnValue({ data, isPending: false, isError: false, error: null, refetch: vi.fn() });

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('ResumenDia', () => {
  it('las tarjetas muestran HM con desglose, diésel con L/HM, producción por sección y AdBlue por verificar', () => {
    mock(BASE);
    render(<ResumenDia />);

    const hm = within(screen.getByTestId('kpi-hm'));
    expect(hm.getByText('10,5')).toBeTruthy();
    expect(hm.getByText(/6 Día \+ 4,5 Noche/)).toBeTruthy();
    expect(hm.getByText('16/10')).toBeTruthy();

    const diesel = within(screen.getByTestId('kpi-diesel'));
    expect(diesel.getByText('120')).toBeTruthy();
    expect(diesel.getByText(/40 Día \+ 60 Noche/)).toBeTruthy();
    expect(diesel.getByText('11,4 L/HM')).toBeTruthy();

    const reports = within(screen.getByTestId('kpi-reports'));
    expect(reports.getByText(/EX-001: 4 HM/)).toBeTruthy();
    expect(reports.getByText(/CM-006: 1,5 HM/)).toBeTruthy();
    expect(reports.queryByText(/CN-007/)).toBeNull();
    expect(reports.getByText('+2 más')).toBeTruthy();

    const prod = within(screen.getByTestId('kpi-produccion'));
    expect(prod.getByText('Internos: 26 (vueltas)')).toBeTruthy();
    expect(prod.getByText('Mina Caleta: 48 (vueltas)')).toBeTruthy();
    expect(prod.getByText('Mineras: 0 (vueltas)')).toBeTruthy();

    const ad = within(screen.getByTestId('kpi-adblue'));
    expect(ad.getByText('Por verificar')).toBeTruthy();
    expect(ad.getByText('Crea el ítem AdBlue en Inventario')).toBeTruthy();
  });

  it('AdBlue con ítem muestra stock y unidad; porHm null muestra —', () => {
    mock({
      ...BASE,
      diesel: { ...BASE.diesel, porHm: null },
      adBlue: { itemId: 'i1', nombre: 'AdBlue 20L', stock: 150.5, unidad: 'LITER' },
    });
    render(<ResumenDia />);
    const ad = within(screen.getByTestId('kpi-adblue'));
    expect(ad.getByText('150,5')).toBeTruthy();
    expect(ad.getByText('L')).toBeTruthy();
    expect(ad.queryByText('Por verificar')).toBeNull();
    expect(within(screen.getByTestId('kpi-diesel')).getByText('— L/HM')).toBeTruthy();
  });

  it('la tabla de operación incluye la fila TOTAL con las sumas', () => {
    mock(BASE);
    render(<ResumenDia />);
    expect(screen.getByText(/Operación por equipo – 16\/10/)).toBeTruthy();
    const total = screen.getByTestId('op-TOTAL');
    const celdas = Array.from(total.querySelectorAll('td')).map((c) => c.textContent);
    expect(celdas).toEqual(['TOTAL', '6', '40', '4,5', '90', '10,5', '150']);
  });

  it('una lectura en curso muestra «en curso» en Final y Avance', () => {
    mock(BASE);
    render(<ResumenDia />);
    const fila = screen.getByTestId('lectura-c2');
    expect(within(fila).getAllByText('en curso')).toHaveLength(2);
    const cerrada = screen.getByTestId('lectura-c1');
    expect(within(cerrada).queryByText('en curso')).toBeNull();
  });

  it('dos tarjetas del mismo equipo y turno renderizan ambas filas sin warning', () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    mock({
      ...BASE,
      lecturas: [
        { id: 'a', internalCode: 'CG-002', turno: 'DIURNO', inicial: 100, final: 102, avance: 2 },
        { id: 'b', internalCode: 'CG-002', turno: 'DIURNO', inicial: 102, final: null, avance: null },
      ],
    });
    render(<ResumenDia />);
    expect(screen.getByTestId('lectura-a')).toBeTruthy();
    expect(screen.getByTestId('lectura-b')).toBeTruthy();
    expect(err).not.toHaveBeenCalled();
    err.mockRestore();
  });

  it('muestra skeleton al cargar y error con reintento', () => {
    resumenHook.mockReturnValue({ data: undefined, isPending: true, isError: false, error: null });
    const { unmount } = render(<ResumenDia />);
    expect(screen.getByTestId('resumen-dia-skeleton')).toBeTruthy();
    unmount();

    const refetch = vi.fn();
    resumenHook.mockReturnValue({
      data: undefined,
      isPending: false,
      isError: true,
      error: new Error('Falló resumen'),
      refetch,
    });
    render(<ResumenDia />);
    expect(screen.getByText('Falló resumen')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /reintentar/i }));
    expect(refetch).toHaveBeenCalled();
  });

  describe('selector de fecha', () => {
    const hoyStr = toDateOnly(new Date());
    const diasAntes = (n: number) => {
      const d = new Date();
      d.setDate(d.getDate() - n);
      return toDateOnly(d);
    };

    it('por defecto consulta hoy (sin param) y oculta "Hoy"; ▶ deshabilitado', () => {
      mock(BASE);
      render(<ResumenDia />);
      expect(resumenHook).toHaveBeenLastCalledWith(undefined);
      expect(screen.queryByRole('button', { name: 'Hoy' })).toBeNull();
      expect((screen.getByRole('button', { name: 'Día siguiente' }) as HTMLButtonElement).disabled).toBe(true);
      const input = screen.getByLabelText('Fecha') as HTMLInputElement;
      expect(input.max).toBe(hoyStr);
      expect(input.value).toBe(hoyStr);
    });

    it('cambiar la fecha llama al hook con el param; "Hoy" resetea', () => {
      mock(BASE);
      render(<ResumenDia />);
      fireEvent.change(screen.getByLabelText('Fecha'), { target: { value: '2026-10-10' } });
      expect(resumenHook).toHaveBeenLastCalledWith('2026-10-10');
      fireEvent.click(screen.getByRole('button', { name: 'Hoy' }));
      expect(resumenHook).toHaveBeenLastCalledWith(undefined);
      expect(screen.queryByRole('button', { name: 'Hoy' })).toBeNull();
    });

    it('◀ retrocede un día y ▶ avanza (hasta hoy)', () => {
      mock(BASE);
      render(<ResumenDia />);
      fireEvent.click(screen.getByRole('button', { name: 'Día anterior' }));
      expect(resumenHook).toHaveBeenLastCalledWith(diasAntes(1));
      fireEvent.click(screen.getByRole('button', { name: 'Día anterior' }));
      expect(resumenHook).toHaveBeenLastCalledWith(diasAntes(2));
      fireEvent.click(screen.getByRole('button', { name: 'Día siguiente' }));
      expect(resumenHook).toHaveBeenLastCalledWith(diasAntes(1));
      fireEvent.click(screen.getByRole('button', { name: 'Día siguiente' }));
      // Al llegar a hoy vuelve a la consulta "viva" (sin param).
      expect(resumenHook).toHaveBeenLastCalledWith(undefined);
    });

    it('ignora una fecha futura, vacía o con año parcial', () => {
      mock(BASE);
      render(<ResumenDia />);
      const input = screen.getByLabelText('Fecha');
      fireEvent.change(input, { target: { value: '2999-01-01' } });
      expect(resumenHook).toHaveBeenLastCalledWith(undefined);
      fireEvent.change(input, { target: { value: '2026-10-10' } });
      expect(resumenHook).toHaveBeenLastCalledWith('2026-10-10');
      // Vacío o año parcial (Chrome emite 0002-10-10 al tipear): la última consulta no cambia.
      fireEvent.change(input, { target: { value: '' } });
      expect(resumenHook).toHaveBeenLastCalledWith('2026-10-10');
      fireEvent.change(input, { target: { value: '0002-10-10' } });
      expect(resumenHook).toHaveBeenLastCalledWith('2026-10-10');
    });

    it('AdBlue en un día pasado rotula "saldo actual" en vez de la fecha', () => {
      mock({ ...BASE, adBlue: { itemId: 'i1', nombre: 'AdBlue 20L', stock: 150.5, unidad: 'LITER' } });
      render(<ResumenDia />);
      fireEvent.click(screen.getByRole('button', { name: 'Día anterior' }));
      expect(within(screen.getByTestId('kpi-adblue')).getByText('saldo actual')).toBeTruthy();
      expect(within(screen.getByTestId('kpi-hm')).queryByText('saldo actual')).toBeNull();
    });
  });
});
