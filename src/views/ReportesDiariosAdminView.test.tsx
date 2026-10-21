import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, cleanup, screen, fireEvent, within } from '@testing-library/react';

import type { ReporteDiario } from '../types/reporte-diario';

const { listHook } = vi.hoisted(() => ({ listHook: vi.fn() }));

vi.mock('../hooks/useReporteDiario', () => ({
  useReportesDiarios: () => listHook(),
}));

import { ReportesDiariosAdminView } from './ReportesDiariosAdminView';

const reporte = (over: Partial<ReporteDiario> & Pick<ReporteDiario, 'id'>): ReporteDiario => ({
  fecha: '2026-10-14T00:00:00.000Z',
  turno: 'DIURNO',
  supervisorId: 's1',
  supervisorNombre: 'Limbert Díaz',
  observaciones: null,
  createdAt: '2026-10-14T20:00:00.000Z',
  updatedAt: '2026-10-14T20:00:00.000Z',
  produccion: [
    { seccion: 'INTERNOS', camiones: 3, vueltasPorCamion: 10 },
    { seccion: 'MINA_CALETA', camiones: 2, vueltasPorCamion: 5 },
    { seccion: 'MINERAS', camiones: 0, vueltasPorCamion: 0 },
  ],
  tolvas: [{ tolva: 1, cargas: 12 }],
  plantas: [{ plantaId: 'p1', producto: 'Chancado 3/4', planta: { nombre: 'Planta Norte' } }],
  traspasos: [{ tipo: 'INTERNOS', cantidad: 4 }],
  empresas: [{ empresaId: 'e1', empresa: { nombre: 'Transportes Andes' } }],
  personal: [
    { rol: 'Jefe de turno', nombre: 'C. Soto', orden: 1 },
    { rol: 'Operador romana', nombre: 'M. Vega', orden: 2 },
  ],
  ...over,
});

const LISTA: ReporteDiario[] = [
  reporte({ id: 'r1', fecha: '2026-10-16T00:00:00.000Z', observaciones: 'Turno sin novedades' }),
  reporte({
    id: 'r2',
    fecha: '2026-10-16T00:00:00.000Z',
    turno: 'NOCTURNO',
    supervisorId: 's2',
    supervisorNombre: 'Patricio Rojas',
  }),
  reporte({ id: 'r3', fecha: '2026-10-14T00:00:00.000Z' }),
];

const ok = (data: ReporteDiario[]) => ({ data, isPending: false, isError: false, error: null });

beforeEach(() => {
  listHook.mockReturnValue(ok(LISTA));
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('ReportesDiariosAdminView', () => {
  it('lista los reportes con fecha, turno, supervisor y vueltas totales', () => {
    render(<ReportesDiariosAdminView />);
    expect(screen.getAllByTestId(/reporte-fila-/)).toHaveLength(3);
    expect(screen.getByTestId('total-reportes').textContent).toBe('3 reportes');
    const fila = within(screen.getByTestId('reporte-fila-r1'));
    expect(fila.getByText('Diurno')).toBeTruthy();
    expect(fila.getByText('Limbert Díaz')).toBeTruthy();
    // 3×10 + 2×5 = 40 vueltas totales.
    expect(fila.getByText('40')).toBeTruthy();
    expect(fila.getByText('Turno sin novedades')).toBeTruthy();
  });

  it('filtra por supervisor y por día', () => {
    render(<ReportesDiariosAdminView />);

    fireEvent.change(screen.getByLabelText(/supervisor/i), { target: { value: 's2' } });
    expect(screen.getAllByTestId(/reporte-fila-/)).toHaveLength(1);
    expect(screen.getByTestId('reporte-fila-r2')).toBeTruthy();

    fireEvent.change(screen.getByLabelText(/supervisor/i), { target: { value: 'TODOS' } });
    fireEvent.change(screen.getByLabelText(/día/i), { target: { value: '2026-10-14' } });
    expect(screen.getAllByTestId(/reporte-fila-/)).toHaveLength(1);
    expect(screen.getByTestId('reporte-fila-r3')).toBeTruthy();
    expect(screen.getByTestId('total-reportes').textContent).toBe('1 reporte');

    fireEvent.change(screen.getByLabelText(/día/i), { target: { value: '2030-01-01' } });
    expect(screen.queryAllByTestId(/reporte-fila-/)).toHaveLength(0);
    expect(screen.getByText('Ningún reporte calza con el filtro.')).toBeTruthy();
  });

  it('clic en una fila abre el detalle completo en un popup', () => {
    render(<ReportesDiariosAdminView />);
    fireEvent.click(screen.getByTestId('reporte-fila-r2'));
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText(/Reporte diario · 16 oct/)).toBeTruthy();
    expect(within(dialog).getByText('Patricio Rojas')).toBeTruthy();
    const internos = within(within(dialog).getByTestId('detalle-seccion-INTERNOS'));
    expect(internos.getByText('Camiones internos')).toBeTruthy();
    expect(internos.getByText('3 camiones × 10 vueltas')).toBeTruthy();
    expect(internos.getByText('30')).toBeTruthy();
    expect(within(dialog).getByText('Tolva 1: 12')).toBeTruthy();
    expect(within(dialog).getByText('Planta Norte')).toBeTruthy();
    expect(within(dialog).getByText('Equipos internos')).toBeTruthy();
    expect(within(dialog).getByText('Transportes Andes')).toBeTruthy();
    expect(within(dialog).getByText('Jefe de turno')).toBeTruthy();
    expect(within(dialog).getByText('C. Soto')).toBeTruthy();
  });

  it('muestra el error del listado', () => {
    listHook.mockReturnValue({ data: undefined, isPending: false, isError: true, error: new Error('Falló Terreno') });
    render(<ReportesDiariosAdminView />);
    expect(screen.getByText('Falló Terreno')).toBeTruthy();
  });
});
