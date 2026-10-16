import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, cleanup, screen, fireEvent } from '@testing-library/react';

const { hoyHook, equiposMock, equiposHook, mantHook } = vi.hoisted(() => ({
  hoyHook: vi.fn(),
  equiposMock: vi.fn(),
  equiposHook: vi.fn(),
  mantHook: vi.fn(),
}));

const idle = { data: undefined, isPending: true, isError: false, error: null };

vi.mock('../hooks/useCurrentUser', () => ({
  useCurrentUser: () => ({ user: { name: 'Admin', email: 'a@x.cl' } }),
}));
vi.mock('../hooks/useMaintenancePlans', () => ({
  useMaintenanceStatusByEquipment: () => mantHook(),
}));
vi.mock('../hooks/useInventory', () => ({
  useItems: () => ({ data: [], isPending: false, isError: false, error: null }),
}));
vi.mock('../hooks/useDashboard', () => ({
  useDashboardHoy: () => hoyHook(),
  useDashboardEquipos: (rango: unknown) => {
    equiposMock(rango);
    return equiposHook();
  },
  useDashboardSummary: () => idle,
  useHallazgosAbiertosResumen: () => idle,
  useHallazgosRecientes: () => idle,
  useHallazgosTendencia: () => idle,
  useHorasFacturables: () => idle,
  useTrabajosExtraordinariosMensual: () => idle,
}));

import { DashboardView } from './DashboardView';

const mockHoy = (value: object) =>
  hoyHook.mockReturnValue({ isPending: false, isError: false, error: null, refetch: vi.fn(), ...value });

const mockEquipos = (data: object[] | undefined) =>
  equiposHook.mockReturnValue(data ? { data, isPending: false, isError: false, error: null } : idle);

const mockMant = (rows: object[]) =>
  mantHook.mockReturnValue({
    data: new Map(rows.map((r) => [(r as { equipmentId: string }).equipmentId, r])),
    isPending: false,
    isError: false,
    error: null,
  });

const equipo = (
  equipmentId: string,
  internalCode: string,
  horas: number,
  litros: number,
  rendimiento: number | null,
  serieDiaria: object[] = [],
) => ({ equipmentId, internalCode, horas, litros, rendimiento, serieDiaria });

beforeEach(() => {
  mockEquipos(undefined);
  mockMant([]);
  mockHoy({ data: { totales: { enUso: 0, disponibles: 0, inoperativos: 0 }, equipos: [] } });
});
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('DashboardView', () => {
  it('la franja HOY muestra los tres contadores y los equipos en uso con operador y turno', async () => {
    mockHoy({
      data: {
        totales: { enUso: 2, disponibles: 3, inoperativos: 1 },
        equipos: [
          { equipmentId: 'e1', internalCode: 'CG-002', estado: 'EN_USO', operador: 'P. Rojas', turno: 'DIURNO', supervisor: 'Limbert' },
          { equipmentId: 'e2', internalCode: 'EX-001', estado: 'DISPONIBLE' },
        ],
      },
    });
    render(<DashboardView />);
    expect(await screen.findByText('2')).toBeTruthy();
    expect(screen.getByText('3')).toBeTruthy();
    expect(screen.getByText('1')).toBeTruthy();
    expect(screen.getByText(/CG-002/)).toBeTruthy();
    expect(screen.getByText(/P\. Rojas · DIURNO/)).toBeTruthy();
    expect(screen.getByText(/EX-001/)).toBeTruthy();
  });

  it('muestra el error de la franja HOY con reintento', () => {
    const refetch = vi.fn();
    hoyHook.mockReturnValue({ data: undefined, isPending: false, isError: true, error: new Error('Falló HOY'), refetch });
    render(<DashboardView />);
    expect(screen.getByText('Falló HOY')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /reintentar/i }));
    expect(refetch).toHaveBeenCalled();
  });

  it('el selector de mes parte en el mes actual y cambiarlo recalcula el rango', () => {
    render(<DashboardView />);
    const hoy = new Date();
    const mesActual = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}`;
    expect(equiposMock).toHaveBeenLastCalledWith(expect.objectContaining({ desde: `${mesActual}-01` }));

    const anterior = new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1);
    const mesAnteriorValue = `${anterior.getFullYear()}-${String(anterior.getMonth() + 1).padStart(2, '0')}`;
    fireEvent.change(screen.getByLabelText(/mes/i), { target: { value: mesAnteriorValue } });
    expect(equiposMock).toHaveBeenLastCalledWith({
      desde: `${mesAnteriorValue}-01`,
      hasta: expect.stringMatching(new RegExp(`^${mesAnteriorValue}-(28|29|30|31)$`)),
    });
  });

  describe('sección Equipos', () => {
    const dia = (fecha: string, horas: number, opero: boolean) => ({ fecha, horas, opero });

    it('calcula los KPIs del rango: horas y litros sumados, L/h ponderado', () => {
      mockEquipos([equipo('e1', 'CG-002', 12, 120, 10), equipo('e2', 'EX-001', 8, 40, 5)]);
      render(<DashboardView />);
      expect(screen.getByTestId('kpi-horas').textContent).toContain('20 h');
      expect(screen.getByTestId('kpi-litros').textContent).toContain('160 L');
      expect(screen.getByTestId('kpi-rendimiento').textContent).toContain('8.0 L/h');
    });

    it('muestra — en L/h con 0 horas totales, nunca NaN ni Infinity', () => {
      mockEquipos([equipo('e1', 'CG-002', 0, 30, null)]);
      render(<DashboardView />);
      expect(screen.getByTestId('kpi-rendimiento').textContent).toContain('—');
      expect(document.body.textContent).not.toMatch(/NaN|Infinity/);
      expect(screen.getByTestId('fila-e1').textContent).toContain('—');
    });

    it('ordena los equipos por horas descendente', () => {
      mockEquipos([
        equipo('e1', 'AA-001', 3, 0, null),
        equipo('e2', 'BB-002', 30, 0, null),
        equipo('e3', 'CC-003', 10, 0, null),
      ]);
      render(<DashboardView />);
      const ids = screen.getAllByTestId(/^fila-/).map((f) => f.getAttribute('data-testid'));
      expect(ids).toEqual(['fila-e2', 'fila-e3', 'fila-e1']);
    });

    it('el drill-down abre por id y atenúa los días sin operar en 0', () => {
      mockEquipos([
        equipo('e1', 'AA-001', 3, 0, null, [dia('2026-10-01', 3, true), dia('2026-10-02', 0, false)]),
        equipo('e2', 'BB-002', 30, 0, null, [dia('2026-10-05', 9, true)]),
      ]);
      render(<DashboardView />);
      expect(screen.queryByTestId('dia-e1-2026-10-02')).toBeNull();
      // e2 va primero (más horas); se abre AA-001 por id, no por posición.
      fireEvent.click(screen.getByRole('button', { name: /AA-001/ }));
      const sinOperar = screen.getByTestId('dia-e1-2026-10-02');
      expect(sinOperar.textContent).toContain('0 h');
      expect(sinOperar.getAttribute('data-opero')).toBe('false');
      expect(sinOperar.className).toContain('opacity-');
      expect(screen.getByTestId('dia-e1-2026-10-01').className).not.toContain('opacity-');
      expect(screen.queryByTestId('dia-e2-2026-10-05')).toBeNull();
      // abrir otro cierra el anterior
      fireEvent.click(screen.getByRole('button', { name: /BB-002/ }));
      expect(screen.queryByTestId('dia-e1-2026-10-02')).toBeNull();
      expect(screen.getByTestId('dia-e2-2026-10-05')).toBeTruthy();
    });

    it('lista como próximos a mantenimiento solo los que cumplen remaining <= alertBefore', () => {
      mockEquipos([
        equipo('e1', 'AA-001', 1, 0, null),
        equipo('e2', 'BB-002', 1, 0, null),
        equipo('e3', 'CC-003', 1, 0, null),
      ]);
      const status = (remaining: number) => ({ counter: 100, next: { milestone: 250, remaining, dueAt: 250 } });
      mockMant([
        { equipmentId: 'e1', unit: 'h', alertBefore: 50, status: status(40) },
        { equipmentId: 'e2', unit: 'h', alertBefore: 50, status: status(200) },
        { equipmentId: 'e3', unit: 'km', alertBefore: null, status: status(10) },
      ]);
      render(<DashboardView />);
      const card = screen.getByTestId('mantencion-proxima-e1');
      expect(card.textContent).toContain('AA-001');
      expect(card.textContent).toContain('40 h');
      expect(screen.queryByTestId('mantencion-proxima-e2')).toBeNull();
      expect(screen.queryByTestId('mantencion-proxima-e3')).toBeNull();
    });
  });
});
