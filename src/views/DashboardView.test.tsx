import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, cleanup, screen, fireEvent } from '@testing-library/react';

const { hoyHook, equiposMock, equiposHook, mantHook, supHook, mantenedoresHook, vueltasHook } = vi.hoisted(() => ({
  hoyHook: vi.fn(),
  equiposMock: vi.fn(),
  equiposHook: vi.fn(),
  mantHook: vi.fn(),
  supHook: vi.fn(),
  mantenedoresHook: vi.fn(),
  vueltasHook: vi.fn(),
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
  useDashboardResumenDia: () => idle,
  useDashboardEquipos: (rango: unknown) => {
    equiposMock(rango);
    return equiposHook();
  },
  useDashboardSupervisores: () => supHook(),
  useDashboardMantenedores: () => mantenedoresHook(),
  useDashboardVueltas: () => vueltasHook(),
  useHallazgosAbiertosResumen: () => idle,
  useHallazgosRecientes: () => idle,
  useHallazgosTendencia: () => idle,
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
  supHook.mockReturnValue(idle);
  mantenedoresHook.mockReturnValue(idle);
  vueltasHook.mockReturnValue(idle);
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
      expect(screen.getByTestId('kpi-rendimiento').textContent).toContain('8 L/h');
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

    it('sin código del equipo (fuente pendiente o con error) muestra un placeholder, nunca el UUID', () => {
      const uuid = '3f2b8c1e-7a44-4d0e-9a51-0c6e2f9b7d10';
      mockEquipos(undefined);
      const status = { counter: 100, next: { milestone: 250, remaining: 10, dueAt: 250 } };
      mockMant([{ equipmentId: uuid, unit: 'h', alertBefore: 50, status }]);
      render(<DashboardView />);
      expect(screen.getByTestId(`mantencion-proxima-${uuid}`).textContent).not.toContain(uuid);
      expect(screen.getByTestId(`mantencion-proxima-${uuid}`).textContent).toContain('…');
    });
  });

  describe('sección Supervisores', () => {
    it('muestra horas DIURNO vs NOCTURNO y la tabla por supervisor, incluido «sin asignar»', () => {
      supHook.mockReturnValue({
        data: {
          porTurno: { DIURNO: { horas: 40, equipos: 3 }, NOCTURNO: { horas: 25, equipos: 2 } },
          porSupervisor: [
            { supervisorId: 's1', nombre: 'Limbert', horas: 50, equipos: 3, turnos: 6 },
            { supervisorId: '', nombre: '(sin asignar)', horas: 15, equipos: 1, turnos: 2 },
          ],
        },
        isPending: false,
        isError: false,
        error: null,
      });
      render(<DashboardView />);
      expect(screen.getByTestId('turno-DIURNO').textContent).toContain('40 h');
      expect(screen.getByTestId('turno-NOCTURNO').textContent).toContain('25 h');
      const fila = screen.getByTestId('supervisor-s1').textContent ?? '';
      expect(fila).toContain('Limbert');
      expect(fila).toContain('50 h');
      expect(fila).toContain('3');
      expect(fila).toContain('6');
      expect(screen.getByTestId('supervisor-sin-asignar').textContent).toContain('(sin asignar)');
    });
  });

  describe('sección Mantenedores', () => {
    it('muestra el total de horas de trabajos extra y una fila por equipo', () => {
      mantenedoresHook.mockReturnValue({
        data: {
          total: { horas: 14, trabajos: 3 },
          porEquipo: [
            { equipmentId: 'e1', internalCode: 'EX-001', horas: 9, trabajos: 2 },
            { equipmentId: 'e2', internalCode: 'CG-002', horas: 5, trabajos: 1 },
          ],
        },
        isPending: false,
        isError: false,
        error: null,
      });
      render(<DashboardView />);
      expect(screen.getByTestId('mantenedores-total').textContent).toContain('14 h');
      expect(screen.getByTestId('mantenedores-total').textContent).toContain('3');
      expect(screen.getByTestId('mantenedor-e1').textContent).toContain('EX-001');
      expect(screen.getByTestId('mantenedor-e1').textContent).toContain('9 h');
    });
  });

  describe('sección Vueltas', () => {
    it('una tarjeta por sección con su total, la nota visible y ningún total general', () => {
      vueltasHook.mockReturnValue({
        data: {
          porSeccion: [
            { seccion: 'INTERNOS', camiones: 2, vueltasTotales: 30, serieDiaria: [{ fecha: '2026-10-01', vueltas: 30 }] },
            { seccion: 'MINERAS', camiones: 1, vueltasTotales: 12, serieDiaria: [] },
          ],
        },
        isPending: false,
        isError: false,
        error: null,
      });
      render(<DashboardView />);
      expect(screen.getByTestId('vueltas-INTERNOS').textContent).toContain('Camiones internos');
      expect(screen.getByTestId('vueltas-INTERNOS').textContent).toContain('30');
      expect(screen.getByTestId('vueltas-MINERAS').textContent).toContain('Camiones mineras');
      expect(screen.getByTestId('vueltas-MINERAS').textContent).toContain('12');
      expect(screen.getByText('Las secciones no se suman: cada una tiene tarifa distinta.')).toBeTruthy();
      expect(screen.queryByTestId('vueltas-total')).toBeNull();
      expect(document.body.textContent).not.toMatch(/total de vueltas|vueltas totales:? ?42/i);
      expect(document.body.textContent).not.toContain('42');
    });
  });
});
