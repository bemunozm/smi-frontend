import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, cleanup, screen, within, fireEvent } from '@testing-library/react';

const { resumenHook, navigateMock, vueltasHook, kardexHook } = vi.hoisted(() => ({
  resumenHook: vi.fn(),
  navigateMock: vi.fn(),
  vueltasHook: vi.fn(),
  kardexHook: vi.fn(),
}));

vi.mock('react-router-dom', () => ({ useNavigate: () => navigateMock }));

vi.mock('../../hooks/useDashboard', () => ({
  useDashboardResumenDia: (fecha?: string) => resumenHook(fecha),
  useDashboardVueltas: (rango: unknown, enabled?: boolean) => vueltasHook(rango, enabled),
}));

vi.mock('../../hooks/useInventory', () => ({ useKardex: (itemId: string | null) => kardexHook(itemId) }));

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
      equipmentId: 'e-cg',
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
    { id: 'c1', equipmentId: 'e-cg', internalCode: 'CG-002', turno: 'DIURNO', inicial: 100, final: 106, avance: 6 },
    { id: 'c2', equipmentId: 'e-cg', internalCode: 'CG-002', turno: 'NOCTURNO', inicial: 106, final: null, avance: null },
  ],
};

const mock = (data: object) =>
  resumenHook.mockReturnValue({ data, isPending: false, isError: false, error: null, refetch: vi.fn() });

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

/** Las consultas de los popups (vueltas, kardex) parten "cargando" salvo que el test diga otra cosa. */
const SIN_CARGA = { data: undefined, isPending: true, isError: false, error: null };

beforeEach(() => {
  vueltasHook.mockReturnValue(SIN_CARGA);
  kardexHook.mockReturnValue(SIN_CARGA);
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

const FLOTA_HOY = [
  { equipmentId: 'e1', internalCode: 'CG-002', estado: 'EN_USO', status: 'OPERATIONAL', operador: 'Hoy Op', turno: 'DIURNO', supervisor: 'Sup', unidadControl: 'HOURS', contadorActual: 10, nivelCombustible: 50 },
  { equipmentId: 'e2', internalCode: 'EX-001', estado: 'INOPERATIVO', status: 'IN_WORKSHOP', unidadControl: 'KM', contadorActual: 5, nivelCombustible: null },
];
const FLOTA_PASADA = [
  { equipmentId: 'e1', internalCode: 'CG-002', estado: 'OPERO', operador: 'Ayer Op', turno: 'NOCTURNO', supervisor: 'Sup', unidadControl: 'HOURS', contadorActual: 10, nivelCombustible: 20 },
  { equipmentId: 'e2', internalCode: 'EX-001', estado: 'SIN_ACTIVIDAD', unidadControl: 'KM', contadorActual: 5, nivelCombustible: null },
];

describe('ResumenDia: una sección, una tarjeta', () => {
  it('título y filtro de fecha viven en la misma cabecera; KPIs, tablas y flota dentro del mismo cuerpo', () => {
    mock({ ...BASE, flota: FLOTA_HOY });
    render(<ResumenDia />);
    const seccion = screen.getByRole('region', { name: 'Resumen del día' });
    expect(within(seccion).getByText('Resumen del día')).toBeTruthy();
    expect(within(seccion).getByLabelText('Fecha')).toBeTruthy();
    expect(within(seccion).getByTestId('kpi-hm')).toBeTruthy();
    expect(within(seccion).getByTestId('op-TOTAL')).toBeTruthy();
    expect(within(seccion).getByRole('region', { name: 'Flota' })).toBeTruthy();
    // El filtro comparte contenedor de cabecera con el título.
    const titulo = within(seccion).getByText('Resumen del día');
    expect(titulo.parentElement!.contains(within(seccion).getByLabelText('Fecha'))).toBe(true);
  });

  it('hoy: chips en uso/disponibles/inoperativos y motivo «En taller»', () => {
    mock({ ...BASE, flota: FLOTA_HOY });
    render(<ResumenDia />);
    expect(screen.getByTestId('contador-EN_USO').textContent).toBe('1 en uso');
    expect(screen.getByTestId('contador-INOPERATIVO').textContent).toBe('1 inoperativos');
    expect(screen.getByText('En taller')).toBeTruthy();
  });

  it('cambiar el filtro re-renderiza KPIs, tablas y carrusel desde el mismo estado', () => {
    resumenHook.mockImplementation((f?: string) => ({
      data: f
        ? { ...BASE, fecha: f, hm: { total: 99, dia: 90, noche: 9 }, flota: FLOTA_PASADA }
        : { ...BASE, flota: FLOTA_HOY },
      isPending: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    }));
    render(<ResumenDia />);
    expect(screen.getByTestId('contador-EN_USO')).toBeTruthy();
    expect(within(screen.getByTestId('kpi-hm')).getByText('10,5')).toBeTruthy();

    fireEvent.change(screen.getByLabelText('Fecha'), { target: { value: '2026-10-10' } });
    expect(within(screen.getByTestId('kpi-hm')).getByText('99')).toBeTruthy();
    expect(screen.getByText(/Operación por equipo – 10\/10/)).toBeTruthy();
    expect(screen.getByTestId('contador-OPERO').textContent).toBe('1 operaron');
    expect(screen.getByTestId('contador-SIN_ACTIVIDAD').textContent).toBe('1 sin actividad');
    expect(screen.getByText('Ayer Op · NOCTURNO')).toBeTruthy();
    expect(screen.getByText('Operó')).toBeTruthy();
    expect(screen.getByText('Sin actividad', { selector: 'span' })).toBeTruthy();
    expect(screen.queryByText('En taller')).toBeNull();
    expect(screen.queryByTestId('contador-EN_USO')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Hoy' }));
    expect(screen.getByTestId('contador-EN_USO')).toBeTruthy();
    expect(screen.getByText('Hoy Op · DIURNO')).toBeTruthy();
  });

  it('día pasado: sin badge de mantención aunque haya alerta; hoy sí', () => {
    const mant = new Map([
      ['e1', { equipmentId: 'e1', unit: 'h', alertBefore: 50, status: { next: { remaining: 10 } } } as never],
    ]);
    resumenHook.mockImplementation((f?: string) => ({
      data: { ...BASE, flota: f ? FLOTA_PASADA : FLOTA_HOY },
      isPending: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    }));
    render(<ResumenDia mantenciones={mant} />);
    expect(screen.getByText('Mantención: quedan 10 h')).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Fecha'), { target: { value: '2026-10-10' } });
    expect(screen.queryByText(/Mantención/)).toBeNull();
  });

  it('flota ausente en el payload (cacheado): estado vacío neutro y el resto se renderiza', () => {
    mock(BASE);
    render(<ResumenDia />);
    expect(screen.getByTestId('flota-sin-datos')).toBeTruthy();
    expect(screen.getByTestId('kpi-hm')).toBeTruthy();
  });

  describe('navegación a la ficha del equipo', () => {
    it('clic en una fila de Operación navega a /equipos/<id>', () => {
      mock(BASE);
      render(<ResumenDia />);
      fireEvent.click(screen.getByTestId('op-CG-002'));
      expect(navigateMock).toHaveBeenCalledWith('/equipos/e-cg', { state: { from: '/' } });
    });

    it('clic en una fila de Lecturas navega a /equipos/<id>', () => {
      mock(BASE);
      render(<ResumenDia />);
      fireEvent.click(screen.getByTestId('lectura-c2'));
      expect(navigateMock).toHaveBeenCalledWith('/equipos/e-cg', { state: { from: '/' } });
    });

    it('Enter sobre una fila con id navega a /equipos/<id>', () => {
      mock(BASE);
      render(<ResumenDia />);
      const fila = screen.getByTestId('op-CG-002');
      fila.focus();
      fireEvent.keyDown(fila, { key: 'Enter' });
      fireEvent.keyUp(fila, { key: 'Enter' });
      expect(navigateMock).toHaveBeenCalledWith('/equipos/e-cg', { state: { from: '/' } });
    });

    it('la fila TOTAL no navega', () => {
      mock(BASE);
      render(<ResumenDia />);
      fireEvent.click(screen.getByTestId('op-TOTAL'));
      expect(navigateMock).not.toHaveBeenCalled();
    });

    it('filas sin equipmentId (payload cacheado) no navegan', () => {
      mock({
        ...BASE,
        operacionPorEquipo: [{ ...BASE.operacionPorEquipo[1], equipmentId: undefined }],
        lecturas: [{ ...BASE.lecturas[0], equipmentId: undefined }],
      });
      render(<ResumenDia />);
      fireEvent.click(screen.getByTestId('op-EX-001'));
      fireEvent.click(screen.getByTestId('lectura-c1'));
      expect(navigateMock).not.toHaveBeenCalled();
    });
  });
});

describe('popups de detalle de las tarjetas KPI', () => {
  const abrir = (nombre: string) => {
    fireEvent.click(screen.getByRole('button', { name: nombre }));
    return screen.getByRole('dialog');
  };
  const celdas = (dialog: HTMLElement, testId: string) =>
    Array.from(within(dialog).getByTestId(testId).querySelectorAll('td')).map((c) => c.textContent);

  it('HM: tabla por equipo con el TOTAL del payload', () => {
    mock(BASE);
    render(<ResumenDia />);
    const dialog = abrir('Ver detalle de HM operacionales');
    expect(within(dialog).getByText('HM operacionales – 16/10')).toBeTruthy();
    expect(celdas(dialog, 'hm-det-CG-002')).toEqual(['CG-002', '6', '4', '10']);
    expect(celdas(dialog, 'hm-det-EX-001')).toEqual(['EX-001', '0', '0,5', '0,5']);
    expect(celdas(dialog, 'hm-det-TOTAL')).toEqual(['TOTAL', '6', '4,5', '10,5']);
    // Sin pie «Ver todo»: el detalle ya es completo.
    expect(within(dialog).queryByRole('button', { name: 'Ver todo →' })).toBeNull();
  });

  it('HM: la fila expande el detalle de las tarjetas del equipo (y ya no navega)', () => {
    mock({
      ...BASE,
      lecturas: [
        {
          ...BASE.lecturas[0],
          operador: 'P. Rojas',
          registradoPor: 'Limbert V.',
          horaEntrada: '2026-10-16T08:00:00.000Z',
          horaSalida: '2026-10-16T18:30:00.000Z',
        },
        BASE.lecturas[1], // payload cacheado: sin los campos nuevos
      ],
    });
    render(<ResumenDia />);
    const dialog = abrir('Ver detalle de HM operacionales');
    fireEvent.click(within(dialog).getByTestId('hm-det-CG-002'));
    const exp = within(dialog).getByTestId('hm-exp-CG-002');
    expect(within(exp).getByText('P. Rojas')).toBeTruthy();
    expect(within(exp).getByText('Registró: Limbert V.')).toBeTruthy();
    expect(within(exp).getByText('100 → 106 (+6)')).toBeTruthy();
    // La tarjeta del payload viejo: sin quién registró y aún en curso.
    expect(within(exp).getByText('Registró: —')).toBeTruthy();
    expect(within(exp).getByText('106 → en curso')).toBeTruthy();
    expect(navigateMock).not.toHaveBeenCalled();
    // Segundo clic colapsa.
    fireEvent.click(within(dialog).getByTestId('hm-det-CG-002'));
    expect(within(dialog).queryByTestId('hm-exp-CG-002')).toBeNull();
  });

  it('Diésel: litros por equipo con L/HM y «Ver todo» a cargas de combustible', () => {
    mock(BASE);
    render(<ResumenDia />);
    const dialog = abrir('Ver detalle de Diésel');
    expect(celdas(dialog, 'diesel-det-CG-002')).toEqual(['CG-002', '40', '30', '80', '8']);
    expect(celdas(dialog, 'diesel-det-EX-001')).toEqual(['EX-001', '0', '60', '70', '140']);
    expect(celdas(dialog, 'diesel-det-TOTAL')).toEqual(['TOTAL', '40', '60', '120', '11,4']);
    fireEvent.click(within(dialog).getByRole('button', { name: 'Ver todo →' }));
    expect(navigateMock).toHaveBeenCalledWith('/cargas-combustible');
  });

  it('Diésel: la fila expande las cargas del equipo (quién cargó, operador, hora, tipo)', () => {
    mock({
      ...BASE,
      cargas: [
        {
          equipmentId: 'e-cg',
          internalCode: 'CG-002',
          litros: 80,
          tipo: 'PETROLEO',
          hora: '2026-10-16T12:00:00.000Z',
          operador: 'P. Rojas',
          cargadoPor: 'Limbert V.',
        },
        // Carga manual sin tarjeta: sin operador ni quién cargó.
        {
          equipmentId: 'e-cg',
          internalCode: 'CG-002',
          litros: 15,
          tipo: 'BENCINA',
          hora: '2026-10-16T13:00:00.000Z',
          operador: null,
          cargadoPor: null,
        },
      ],
    });
    render(<ResumenDia />);
    const dialog = abrir('Ver detalle de Diésel');
    fireEvent.click(within(dialog).getByTestId('diesel-det-CG-002'));
    const exp = within(dialog).getByTestId('diesel-exp-CG-002');
    expect(within(exp).getByText('80 L · Petróleo')).toBeTruthy();
    expect(within(exp).getByText('Cargó: Limbert V.')).toBeTruthy();
    expect(within(exp).getByText('Operador: P. Rojas')).toBeTruthy();
    expect(within(exp).getByText('15 L · Bencina')).toBeTruthy();
    expect(within(exp).getByText('Cargó: —')).toBeTruthy();
    expect(navigateMock).not.toHaveBeenCalled();
  });

  it('Diésel: payload cacheado sin cargas[] avisa que no hay detalle', () => {
    mock(BASE); // sin `cargas`
    render(<ResumenDia />);
    const dialog = abrir('Ver detalle de Diésel');
    fireEvent.click(within(dialog).getByTestId('diesel-det-EX-001'));
    expect(within(within(dialog).getByTestId('diesel-exp-EX-001')).getByText('Detalle no disponible en este payload.')).toBeTruthy();
  });

  it('Reports: lista el día completo (la card corta en 3) y «Ver todo» va a Report', () => {
    mock(BASE);
    render(<ResumenDia />);
    const dialog = abrir('Ver detalle de Reports');
    expect(within(dialog).getByTestId('reports-det-CN-007')).toBeTruthy();
    expect(within(dialog).getByTestId('reports-det-AA-001')).toBeTruthy();
    expect(within(dialog).getByText('9 HM')).toBeTruthy();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Ver todo →' }));
    expect(navigateMock).toHaveBeenCalledWith('/trabajos-extra');
  });

  it('Reports: la fila con equipmentId navega a Report filtrado por equipo y día', () => {
    mock({
      ...BASE,
      reports: {
        totalHoras: 9,
        porEquipo: [
          { equipmentId: 'e-ex', internalCode: 'EX-001', horas: 4 },
          { internalCode: 'CG-002', horas: 2.5 }, // payload viejo: sin id, no navegable
        ],
      },
    });
    render(<ResumenDia />);
    const dialog = abrir('Ver detalle de Reports');
    expect(within(dialog).queryByRole('button', { name: 'Ver reports de CG-002' })).toBeNull();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Ver reports de EX-001' }));
    expect(navigateMock).toHaveBeenCalledWith('/trabajos-extra?equipo=e-ex&desde=2026-10-16&hasta=2026-10-16');
  });

  it('Producción: camiones del endpoint de vueltas del día; vueltas, del payload de la card', () => {
    vueltasHook.mockReturnValue({
      data: {
        porSeccion: [
          { seccion: 'INTERNOS', camiones: 4, vueltasTotales: 26, serieDiaria: [] },
          { seccion: 'MINA_CALETA', camiones: 6, vueltasTotales: 48, serieDiaria: [] },
        ],
      },
      isPending: false,
      isError: false,
      error: null,
    });
    mock(BASE);
    render(<ResumenDia />);
    const dialog = abrir('Ver detalle de Producción');
    expect(vueltasHook).toHaveBeenLastCalledWith({ desde: '2026-10-16', hasta: '2026-10-16' }, true);
    expect(celdas(dialog, 'prod-det-INTERNOS')).toEqual(['Internos', '4', '26']);
    expect(celdas(dialog, 'prod-det-MINA_CALETA')).toEqual(['Mina Caleta', '6', '48']);
    expect(celdas(dialog, 'prod-det-MINERAS')).toEqual(['Mineras', '—', '0']);
    expect(celdas(dialog, 'prod-det-TOTAL')).toEqual(['TOTAL', '10', '74']);
    fireEvent.click(within(dialog).getByRole('button', { name: 'Ver todo →' }));
    expect(navigateMock).toHaveBeenCalledWith('/reportes-diarios');
  });

  it('AdBlue: kardex filtrado al día y «Ver todo» a la ficha del ítem', () => {
    kardexHook.mockReturnValue({
      data: {
        movements: [
          {
            id: 'm1',
            direction: 'IN',
            reason: 'PURCHASE',
            quantity: 20,
            occurredAt: '2026-10-16T12:00:00.000Z',
            equipment: null,
          },
          {
            id: 'm2',
            direction: 'OUT',
            reason: 'ACTIVITY',
            quantity: 5,
            occurredAt: '2026-10-14T12:00:00.000Z',
            equipment: { id: 'e-cg', internalCode: 'CG-002' },
          },
        ],
      },
      isPending: false,
      isError: false,
      error: null,
    });
    mock({ ...BASE, adBlue: { itemId: 'i1', nombre: 'AdBlue 20L', stock: 150.5, unidad: 'LITER', stockLitros: null } });
    render(<ResumenDia />);
    const dialog = abrir('Ver detalle de AdBlue');
    expect(kardexHook).toHaveBeenLastCalledWith('i1');
    expect(within(dialog).getByText('Saldo actual: 150,5 L')).toBeTruthy();
    const mov = within(dialog).getByTestId('adblue-mov-m1');
    expect(within(mov).getByText('Entrada')).toBeTruthy();
    expect(within(mov).getByText('Compra / reposición')).toBeTruthy();
    expect(within(mov).getByText('+20 L')).toBeTruthy();
    // El movimiento de otro día no aparece.
    expect(within(dialog).queryByTestId('adblue-mov-m2')).toBeNull();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Ver todo →' }));
    expect(navigateMock).toHaveBeenCalledWith('/inventario/i1');
  });

  it('sin ítem AdBlue la tarjeta no es un botón', () => {
    mock(BASE);
    render(<ResumenDia />);
    expect(screen.queryByRole('button', { name: 'Ver detalle de AdBlue' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Ver detalle de HM operacionales' })).toBeTruthy();
  });

  it('en un día pasado el popup de AdBlue aclara que el saldo es el vivo', () => {
    kardexHook.mockReturnValue({ data: { movements: [] }, isPending: false, isError: false, error: null });
    mock({ ...BASE, adBlue: { itemId: 'i1', nombre: 'AdBlue 20L', stock: 150.5, unidad: 'LITER' } });
    render(<ResumenDia />);
    fireEvent.click(screen.getByRole('button', { name: 'Día anterior' }));
    const dialog = abrir('Ver detalle de AdBlue');
    expect(within(dialog).getByText(/El saldo es el vivo de Inventario/)).toBeTruthy();
    expect(within(dialog).getByText('Sin movimientos este día.')).toBeTruthy();
  });
});
