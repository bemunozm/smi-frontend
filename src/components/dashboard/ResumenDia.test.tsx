import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, cleanup, screen, within, fireEvent } from '@testing-library/react';

const { resumenHook } = vi.hoisted(() => ({ resumenHook: vi.fn() }));

vi.mock('../../hooks/useDashboard', () => ({
  useDashboardResumenDia: () => resumenHook(),
}));

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
    { internalCode: 'CG-002', turno: 'DIURNO', inicial: 100, final: 106, avance: 6 },
    { internalCode: 'CG-002', turno: 'NOCTURNO', inicial: 106, final: null, avance: null },
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
    const fila = screen.getByTestId('lectura-CG-002-NOCTURNO');
    expect(within(fila).getAllByText('en curso')).toHaveLength(2);
    const cerrada = screen.getByTestId('lectura-CG-002-DIURNO');
    expect(within(cerrada).queryByText('en curso')).toBeNull();
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
});
