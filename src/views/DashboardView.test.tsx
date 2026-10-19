import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, cleanup, screen, fireEvent, within } from '@testing-library/react';

const { navigateMock, itemsHook, abiertosHook, recientesHook, hallazgosResumenHook, resumenHook, equiposMock, equiposHook, mantHook, supHook, mantenedoresHook, vueltasHook } = vi.hoisted(() => ({
  navigateMock: vi.fn(),
  itemsHook: vi.fn(),
  abiertosHook: vi.fn(),
  recientesHook: vi.fn(),
  hallazgosResumenHook: vi.fn(),
  resumenHook: vi.fn(),
  equiposMock: vi.fn(),
  equiposHook: vi.fn(),
  mantHook: vi.fn(),
  supHook: vi.fn(),
  mantenedoresHook: vi.fn(),
  vueltasHook: vi.fn(),
}));

const idle = { data: undefined, isPending: true, isError: false, error: null };

vi.mock('react-router-dom', () => ({ useNavigate: () => navigateMock }));
vi.mock('../hooks/useCurrentUser', () => ({
  useCurrentUser: () => ({ user: { name: 'Admin', email: 'a@x.cl' } }),
}));
vi.mock('../hooks/useMaintenancePlans', () => ({
  useMaintenanceStatusByEquipment: () => mantHook(),
}));
vi.mock('../hooks/useInventory', () => ({
  useItems: () => itemsHook(),
}));
vi.mock('../hooks/useDashboard', () => ({
  useDashboardResumenDia: () => resumenHook(),
  useDashboardEquipos: (rango: unknown) => {
    equiposMock(rango);
    return equiposHook();
  },
  useDashboardSupervisores: () => supHook(),
  useDashboardMantenedores: () => mantenedoresHook(),
  useDashboardVueltas: () => vueltasHook(),
  useHallazgosAbiertosResumen: () => hallazgosResumenHook(),
  useHallazgosAbiertosRecientes: () => abiertosHook(),
  useHallazgosRecientes: () => recientesHook(),
}));

import { DashboardView } from './DashboardView';

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
  resumenHook.mockReturnValue(idle);
  hallazgosResumenHook.mockReturnValue(idle);
  recientesHook.mockReturnValue(idle);
  itemsHook.mockReturnValue({ data: [], isPending: false, isError: false, error: null });
  abiertosHook.mockReturnValue({ data: [], isPending: false, isError: false, error: null });
});
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('DashboardView', () => {
  describe('KPIs con datos reales abren un popup con su detalle', () => {
    const ok = (data: unknown) => ({ data, isPending: false, isError: false, error: null });
    const fila = (equipmentId: string, unit: 'h' | 'km', remaining: number, milestone = 500) => ({
      equipmentId,
      unit,
      alertBefore: 50,
      status: { next: { milestone, remaining } },
    });
    const hallazgo = (id: string, equipo: string, descripcion: string) => ({
      id,
      equipo,
      descripcion,
      criticidad: 'ALTA',
      estado: 'ABIERTO',
      fecha: '2026-10-16T12:00:00.000Z',
    });
    const stockRow = (id: string, name: string, quantity: number, minimumQuantity: number) => ({
      id,
      name,
      sku: `SKU-${id}`,
      unit: 'LITER',
      stocks: [{ branchId: 'b1', branch: { name: 'Bodega Central' }, quantity, minimumQuantity }],
    });

    beforeEach(() => {
      hallazgosResumenHook.mockReturnValue(
        ok({ abiertos: 12, porPrioridad: { critica: 0, alta: 1, media: 1, baja: 1 } }),
      );
      mockEquipos([equipo('e1', 'CG-002', 10, 5, 0.5), equipo('e2', 'EX-001', 10, 5, 0.5), equipo('e3', 'CM-009', 1, 1, 1)]);
    });

    const abrir = (nombre: string) => {
      render(<DashboardView />);
      fireEvent.click(screen.getByRole('button', { name: nombre }));
      return screen.getByRole('dialog');
    };

    it.each(['Ver próximas mantenciones', 'Ver ítems bajo mínimo', 'Ver hallazgos abiertos'])(
      '«%s» abre un popup y no navega directo',
      (nombre) => {
        abrir(nombre);
        expect(navigateMock).not.toHaveBeenCalled();
      },
    );

    describe('Próximas mantenciones', () => {
      beforeEach(() => {
        mockMant([fila('e1', 'h', 20, 500), fila('e2', 'km', 5, 10000), fila('e3', 'h', 0, 250)]);
      });

      it('lista solo las de horómetro (excluye km), la más urgente primero', () => {
        const dialog = abrir('Ver próximas mantenciones');
        expect(within(dialog).getByText('Próximas mantenciones')).toBeTruthy();
        expect(within(dialog).getByText('CG-002')).toBeTruthy();
        expect(within(dialog).getByText('Quedan 20 h')).toBeTruthy();
        expect(within(dialog).getByText('Toca ahora')).toBeTruthy();
        expect(within(dialog).queryByText('EX-001')).toBeNull();
        const filas = within(dialog).getAllByTestId(/kpi-mantencion-/);
        expect(filas.map((f) => f.getAttribute('data-testid'))).toEqual(['kpi-mantencion-e3', 'kpi-mantencion-e1']);
        // La nota de exclusión aparece porque el conteo de la card (3) incluye la de km.
        expect(within(dialog).getByText(/las de kilometraje están en «Ver todo»/)).toBeTruthy();
      });

      it('sin filas de km no muestra la nota de exclusión', () => {
        mockMant([fila('e1', 'h', 20, 500)]);
        const dialog = abrir('Ver próximas mantenciones');
        expect(within(dialog).queryByText(/kilometraje/)).toBeNull();
      });

      it('excluye las que no cumplen remaining <= alertBefore o sin alertBefore', () => {
        mockMant([
          fila('e1', 'h', 40, 250),
          fila('e2', 'h', 200, 500), // fuera de ventana (alertBefore 50)
          { equipmentId: 'e3', unit: 'h', alertBefore: null, status: { next: { milestone: 250, remaining: 10 } } },
        ]);
        const dialog = abrir('Ver próximas mantenciones');
        expect(within(dialog).getByTestId('kpi-mantencion-e1')).toBeTruthy();
        expect(within(dialog).queryByTestId('kpi-mantencion-e2')).toBeNull();
        expect(within(dialog).queryByTestId('kpi-mantencion-e3')).toBeNull();
      });

      it('sin código del equipo muestra un placeholder, nunca el UUID', () => {
        const uuid = '3f2b8c1e-7a44-4d0e-9a51-0c6e2f9b7d10';
        mockEquipos(undefined);
        mockMant([fila(uuid, 'h', 10, 250)]);
        const dialog = abrir('Ver próximas mantenciones');
        const filaDom = within(dialog).getByTestId(`kpi-mantencion-${uuid}`);
        expect(filaDom.textContent).not.toContain(uuid);
        expect(filaDom.textContent).toContain('…');
      });

      it('muestra el estado vacío si solo hay mantenciones por km', () => {
        mockMant([fila('e2', 'km', 5)]);
        const dialog = abrir('Ver próximas mantenciones');
        expect(within(dialog).getByText('Sin mantenciones próximas por horómetro.')).toBeTruthy();
      });

      it('«Ver todo» navega a la vista de preventivo', () => {
        const dialog = abrir('Ver próximas mantenciones');
        fireEvent.click(within(dialog).getByRole('button', { name: /Ver todo/ }));
        expect(navigateMock).toHaveBeenCalledWith('/mantenimiento/preventivo');
      });

      it('se cierra con Esc y con el botón de cierre', () => {
        const dialog = abrir('Ver próximas mantenciones');
        fireEvent.keyDown(dialog, { key: 'Escape' });
        expect(screen.queryByRole('dialog')).toBeNull();
        fireEvent.click(screen.getByRole('button', { name: 'Ver próximas mantenciones' }));
        fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: /close|cerrar/i }));
        expect(screen.queryByRole('dialog')).toBeNull();
      });
    });

    describe('Ítems bajo mínimo', () => {
      beforeEach(() => {
        itemsHook.mockReturnValue(ok([stockRow('i1', 'Aceite 15W40', 8, 10), stockRow('i2', 'AdBlue', 0, 20), stockRow('i3', 'Grasa', 50, 10)]));
      });

      it('muestra «N de M unidad», peor primero, sin los que están sobre el mínimo', () => {
        const dialog = abrir('Ver ítems bajo mínimo');
        expect(within(dialog).getByText('Ítems bajo mínimo')).toBeTruthy();
        expect(within(dialog).getByText('8 de 10 L')).toBeTruthy();
        expect(within(dialog).getByText('0 de 20 L')).toBeTruthy();
        expect(within(dialog).queryByText('Grasa')).toBeNull();
        const nombres = within(dialog).getAllByText(/Aceite 15W40|AdBlue/).map((n) => n.textContent);
        expect(nombres).toEqual(['AdBlue', 'Aceite 15W40']);
      });

      it('«Ver todo» navega al inventario filtrado', () => {
        const dialog = abrir('Ver ítems bajo mínimo');
        fireEvent.click(within(dialog).getByRole('button', { name: /Ver todo/ }));
        expect(navigateMock).toHaveBeenCalledWith('/inventario?filtro=bajo-minimo');
      });

      it('estado vacío', () => {
        itemsHook.mockReturnValue(ok([]));
        const dialog = abrir('Ver ítems bajo mínimo');
        expect(within(dialog).getByText('Ningún ítem está bajo el mínimo.')).toBeTruthy();
      });
    });

    describe('Hallazgos abiertos', () => {
      it('lista los abiertos recientes con equipo, chips y descripción, e indica el tope', () => {
        abiertosHook.mockReturnValue(ok([hallazgo('h1', 'CG-002', 'Fuga de aceite'), hallazgo('h2', 'EX-001', 'Neumático gastado')]));
        const dialog = abrir('Ver hallazgos abiertos');
        expect(within(dialog).getByText('Hallazgos abiertos')).toBeTruthy();
        expect(within(dialog).getByText('Fuga de aceite')).toBeTruthy();
        expect(within(dialog).getByText('Neumático gastado')).toBeTruthy();
        expect(within(dialog).getAllByText('ALTA')).toHaveLength(2);
        expect(within(dialog).getByText('Mostrando los 2 más recientes de 12.')).toBeTruthy();
      });

      it('«Ver todo» navega a los hallazgos de terreno', () => {
        const dialog = abrir('Ver hallazgos abiertos');
        fireEvent.click(within(dialog).getByRole('button', { name: /Ver todo/ }));
        expect(navigateMock).toHaveBeenCalledWith('/hallazgos');
      });
    });
  });

  it('el resumen del día incluye la flota de hoy (chips, equipos con operador y turno) en una sola sección', async () => {
    resumenHook.mockReturnValue({
      data: {
        fecha: '2026-10-16',
        hm: { total: 0, dia: 0, noche: 0 },
        diesel: { total: 0, dia: 0, noche: 0, porHm: null },
        reports: { totalHoras: 0, porEquipo: [] },
        produccion: { internos: 0, minaCaleta: 0, mineras: 0 },
        adBlue: null,
        operacionPorEquipo: [],
        lecturas: [],
        flota: [
          { equipmentId: 'e1', internalCode: 'CG-002', estado: 'EN_USO', status: 'OPERATIONAL', operador: 'P. Rojas', turno: 'DIURNO', supervisor: 'Limbert' },
          { equipmentId: 'e2', internalCode: 'EX-001', estado: 'DISPONIBLE', status: 'OPERATIONAL' },
        ],
      },
      isPending: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    });
    render(<DashboardView />);
    expect((await screen.findByTestId('contador-EN_USO')).textContent).toBe('1 en uso');
    expect(screen.getByTestId('contador-DISPONIBLE').textContent).toBe('1 disponibles');
    expect(screen.getByText(/P. Rojas · DIURNO/)).toBeTruthy();
    // Ya no hay una sección HOY independiente: la flota vive dentro del resumen del día.
    expect(screen.queryByRole('region', { name: 'Flota hoy' })).toBeNull();
    expect(within(screen.getByRole('region', { name: 'Resumen del día' })).getByRole('region', { name: 'Flota' })).toBeTruthy();
  });

  it('muestra el error del resumen del día (incluye la flota) con reintento', () => {
    const refetch = vi.fn();
    resumenHook.mockReturnValue({ data: undefined, isPending: false, isError: true, error: new Error('Falló resumen'), refetch });
    render(<DashboardView />);
    expect(screen.getByText('Falló resumen')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /reintentar/i }));
    expect(refetch).toHaveBeenCalled();
  });

  it('cada sección tiene su selector de mes; el de Equipos parte en el mes actual y recalcula su rango', () => {
    render(<DashboardView />);
    const hoy = new Date();
    const mesActual = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}`;
    expect(equiposMock).toHaveBeenCalledWith(expect.objectContaining({ desde: `${mesActual}-01` }));

    // Un filtro por sección (Equipos y Supervisores), ya no uno global en el header.
    const selectores = screen.getAllByLabelText(/mes/i);
    expect(selectores).toHaveLength(2);

    const anterior = new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1);
    const mesAnteriorValue = `${anterior.getFullYear()}-${String(anterior.getMonth() + 1).padStart(2, '0')}`;
    fireEvent.change(selectores[0], { target: { value: mesAnteriorValue } });
    expect(equiposMock).toHaveBeenCalledWith({
      desde: `${mesAnteriorValue}-01`,
      hasta: expect.stringMatching(new RegExp(`^${mesAnteriorValue}-(28|29|30|31)$`)),
    });
  });

  describe('hallazgos recientes', () => {
    const reciente = (fotoUrl: string | null) => ({
      id: 'h9',
      equipo: 'PE-004',
      descripcion: 'Fuga de aceite hidráulico en cilindro de levante',
      criticidad: 'ALTA',
      estado: 'ABIERTO',
      fecha: '2026-10-14T15:02:00.000Z',
      fotoUrl,
    });

    it('clic en un hallazgo abre un popup con su detalle, foto incluida', () => {
      recientesHook.mockReturnValue({ data: [reciente('https://signed/foto.jpg')], isPending: false, isError: false, error: null });
      render(<DashboardView />);
      fireEvent.click(screen.getByRole('button', { name: 'Ver detalle del hallazgo de PE-004' }));
      const dialog = screen.getByRole('dialog');
      expect(within(dialog).getByText('Hallazgo · PE-004')).toBeTruthy();
      expect(within(dialog).getByText('Fuga de aceite hidráulico en cilindro de levante')).toBeTruthy();
      expect(within(dialog).getByText('ALTA')).toBeTruthy();
      expect(within(dialog).getByText('Abierto')).toBeTruthy();
      const foto = within(dialog).getByRole('img', { name: 'Foto del hallazgo de PE-004' });
      expect(foto.getAttribute('src')).toBe('https://signed/foto.jpg');
    });

    it('sin foto adjunta, el popup lo dice en vez de romper', () => {
      recientesHook.mockReturnValue({ data: [reciente(null)], isPending: false, isError: false, error: null });
      render(<DashboardView />);
      fireEvent.click(screen.getByRole('button', { name: 'Ver detalle del hallazgo de PE-004' }));
      const dialog = screen.getByRole('dialog');
      expect(within(dialog).getByText('Sin foto adjunta.')).toBeTruthy();
      expect(within(dialog).queryByRole('img')).toBeNull();
    });
  });

  describe('sección Equipos', () => {
    const dia = (fecha: string, horas: number, opero: boolean) => ({ fecha, horas, opero });

    describe('horas máquina por semana', () => {
      const dia = (fecha: string, horas: number) => ({ fecha, horas, opero: horas > 0 });

      it('muestra la leyenda de equipos activos y omite el de 0 horas', () => {
        mockEquipos([
          equipo('e1', 'CG-002', 5, 0, null, [dia('2026-10-13', 5)]),
          equipo('e2', 'EX-001', 3, 0, null, [dia('2026-10-14', 3)]),
          equipo('e3', 'CM-009', 0, 0, null, [dia('2026-10-14', 0)]),
        ]);
        render(<DashboardView />);
        expect(screen.getByText('Horas máquina por semana')).toBeTruthy();
        const leyenda = within(screen.getByTestId('leyenda-horas-semanales'));
        expect(leyenda.getByText('CG-002')).toBeTruthy();
        expect(leyenda.getByText('EX-001')).toBeTruthy();
        expect(leyenda.queryByText('CM-009')).toBeNull();
      });

      it('sin actividad muestra el vacío', () => {
        mockEquipos([equipo('e1', 'CG-002', 0, 0, null, [dia('2026-10-13', 0)])]);
        render(<DashboardView />);
        expect(screen.getByText('Sin actividad en el rango.')).toBeTruthy();
      });

      it('consulta un rango fijo de 8 semanas atrás, sin selector y sin tocar el del mes', () => {
        mockEquipos([]);
        render(<DashboardView />);
        // El selector de semanas se sacó a pedido del administrador: rango fijo.
        expect(screen.queryByLabelText('Rango de semanas')).toBeNull();
        const hoy = new Date();
        // lunes de la semana de (hoy - 7*7 días): exactamente 8 semanas incluyendo la actual
        const base = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() - 7 * 7);
        const lunes = new Date(base.getFullYear(), base.getMonth(), base.getDate() - ((base.getDay() + 6) % 7));
        const f = (d: Date) =>
          `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        expect(equiposMock).toHaveBeenCalledWith({ desde: f(lunes), hasta: f(hoy) });
        // el rango mensual sigue consultándose aparte (desde = día 1)
        const llamadas = equiposMock.mock.calls.map((c) => c[0] as { desde: string });
        expect(llamadas.some((r) => r.desde.endsWith('-01'))).toBe(true);
      });
    });

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
      expect(screen.getByTestId('vueltas-INTERNOS').textContent).toContain('Vueltas camiones internos');
      expect(screen.getByTestId('vueltas-INTERNOS').textContent).toContain('30');
      expect(screen.getByTestId('vueltas-MINERAS').textContent).toContain('Vueltas camiones mineras');
      expect(screen.getByTestId('vueltas-MINERAS').textContent).toContain('12');
      expect(screen.queryByTestId('vueltas-total')).toBeNull();
      expect(document.body.textContent).not.toMatch(/total de vueltas|vueltas totales:? ?42/i);
      expect(document.body.textContent).not.toContain('42');
    });
  });
});
