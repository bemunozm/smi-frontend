import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, cleanup, screen, fireEvent, within } from '@testing-library/react';

import type { ReporteDiario } from '../types/reporte-diario';

const { listHook, navigateMock, eliminarMock } = vi.hoisted(() => ({
  listHook: vi.fn(),
  navigateMock: vi.fn(),
  eliminarMock: vi.fn(),
}));
const { rol } = vi.hoisted(() => ({ rol: { value: 'ADMIN' as 'ADMIN' | 'SECRETARIA' | 'MANTENEDOR' } }));

vi.mock('react-router-dom', async (original) => ({
  ...(await original<typeof import('react-router-dom')>()),
  useNavigate: () => navigateMock,
}));

vi.mock('../hooks/usePermissions', async () => {
  const { canWrite } = await import('../lib/permissions');
  return {
    usePermissions: () => ({
      role: rol.value,
      can: (action: Parameters<typeof canWrite>[1]) => canWrite(rol.value, action),
    }),
  };
});

vi.mock('../hooks/useReporteDiario', () => ({
  useReportesDiarios: () => listHook(),
  useEliminarReporteDiario: () => ({ mutate: eliminarMock, isPending: false }),
}));

// Resumen del turno del reporte abierto (operadores del Informe diario
// equipos). `RESUMEN_HOOK` registra con qué selección se llamó (null = la
// consulta está apagada); cada test pisa `resumenTurno` según necesite.
const RESUMEN_HOOK = vi.hoisted(() => vi.fn());
let resumenTurno: unknown[] = [];
vi.mock('../hooks/usePastShiftSummary', () => ({
  usePastShiftSummary: (sel: unknown) => {
    RESUMEN_HOOK(sel);
    return { data: sel ? resumenTurno : undefined };
  },
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
  rol.value = 'ADMIN';
  listHook.mockReturnValue(ok(LISTA));
  resumenTurno = [];
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

  it('«Cargar o corregir reporte» lleva al formulario con fecha y turno a elección', () => {
    rol.value = 'SECRETARIA';
    render(<ReportesDiariosAdminView />);
    fireEvent.click(screen.getByRole('button', { name: 'Cargar o corregir reporte' }));
    expect(navigateMock).toHaveBeenCalledWith('/reportes-diarios/cargar');
  });

  it('sin permiso de carga no ofrece el botón', () => {
    rol.value = 'MANTENEDOR';
    render(<ReportesDiariosAdminView />);
    expect(screen.queryByRole('button', { name: 'Cargar o corregir reporte' })).toBeNull();
  });

  it('muestra el error del listado', () => {
    listHook.mockReturnValue({ data: undefined, isPending: false, isError: true, error: new Error('Falló Terreno') });
    render(<ReportesDiariosAdminView />);
    expect(screen.getByText('Falló Terreno')).toBeTruthy();
  });

  it('ADMIN ve «Eliminar reporte» y eliminar pide confirmación antes de llamar al backend', () => {
    render(<ReportesDiariosAdminView />);
    fireEvent.click(screen.getByTestId('reporte-fila-r2'));
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Eliminar reporte' }));

    // El detalle se cierra y la confirmación nombra reporte, turno y supervisor.
    const confirmacion = screen.getByRole('alertdialog');
    expect(within(confirmacion).getByText(/Patricio Rojas/)).toBeTruthy();
    expect(eliminarMock).not.toHaveBeenCalled();
    fireEvent.click(within(confirmacion).getByRole('button', { name: 'Eliminar' }));
    expect(eliminarMock).toHaveBeenCalledWith('r2', expect.anything());
  });

  it('«Corregir reporte» lleva al formulario con ese reporte abierto', () => {
    render(<ReportesDiariosAdminView />);
    fireEvent.click(screen.getByTestId('reporte-fila-r2'));
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Corregir reporte' }));
    expect(navigateMock).toHaveBeenCalledWith('/reportes-diarios/cargar', {
      state: { fecha: '2026-10-16', turno: 'NOCTURNO', reporteId: 'r2' },
    });
  });

  it('SECRETARIA puede corregir pero no ve «Eliminar reporte»', () => {
    rol.value = 'SECRETARIA';
    render(<ReportesDiariosAdminView />);
    fireEvent.click(screen.getByTestId('reporte-fila-r1'));
    const dialog = within(screen.getByRole('dialog'));
    expect(dialog.getByRole('button', { name: 'Corregir reporte' })).toBeTruthy();
    expect(dialog.queryByRole('button', { name: 'Eliminar reporte' })).toBeNull();
  });

  it('el detalle muestra los operadores del turno del supervisor del reporte, sin camionetas', () => {
    resumenTurno = [
      {
        id: 'sh-s2',
        supervisorId: 's2',
        cards: [
          { id: 'c1', operatorName: 'Juan Carvajal', equipo: { internalCode: 'CG-002', equipmentClass: 'HEAVY' } },
          { id: 'c2', operatorName: 'Pedro Soto', equipo: { internalCode: 'CM-NUV', equipmentClass: 'LIGHT' } },
        ],
      },
      {
        id: 'sh-s1',
        supervisorId: 's1',
        cards: [{ id: 'c3', operatorName: 'Otro Operador', equipo: { internalCode: 'SEM 05', equipmentClass: 'HEAVY' } }],
      },
    ];
    render(<ReportesDiariosAdminView />);
    fireEvent.click(screen.getByTestId('reporte-fila-r2')); // supervisorId s2, NOCTURNO del 16-10

    expect(RESUMEN_HOOK).toHaveBeenLastCalledWith(expect.objectContaining({ turno: 'NOCTURNO' }));
    const ops = within(screen.getByTestId('detalle-operadores'));
    expect(ops.getByText('Juan Carvajal · CG-002')).toBeTruthy();
    // La camioneta no lleva operador del turno, y las tarjetas de OTRO supervisor no son de este reporte.
    expect(ops.queryByText(/Pedro Soto/)).toBeNull();
    expect(ops.queryByText(/Otro Operador/)).toBeNull();
  });

  it('si el turno no tiene grupo del supervisor del reporte (backfill del panel), muestra las de todo el turno', () => {
    resumenTurno = [
      {
        id: 'sh-otro',
        supervisorId: 'alguien-mas',
        cards: [{ id: 'c9', operatorName: 'Marcos Vega', equipo: { internalCode: 'SANY 02', equipmentClass: 'HEAVY' } }],
      },
    ];
    render(<ReportesDiariosAdminView />);
    fireEvent.click(screen.getByTestId('reporte-fila-r1'));
    expect(within(screen.getByTestId('detalle-operadores')).getByText('Marcos Vega · SANY 02')).toBeTruthy();
  });

  it('SECRETARIA no consulta el resumen del turno y no ve la sección de operadores', () => {
    rol.value = 'SECRETARIA';
    render(<ReportesDiariosAdminView />);
    fireEvent.click(screen.getByTestId('reporte-fila-r1'));
    expect(RESUMEN_HOOK).toHaveBeenLastCalledWith(null);
    expect(within(screen.getByRole('dialog')).queryByText('Operadores del turno')).toBeNull();
  });
});
