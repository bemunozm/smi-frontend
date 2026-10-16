import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, cleanup, screen, fireEvent } from '@testing-library/react';

const { hoyHook, equiposMock } = vi.hoisted(() => ({
  hoyHook: vi.fn(),
  equiposMock: vi.fn(),
}));

const idle = { data: undefined, isPending: true, isError: false, error: null };

vi.mock('../hooks/useCurrentUser', () => ({
  useCurrentUser: () => ({ user: { name: 'Admin', email: 'a@x.cl' } }),
}));
vi.mock('../hooks/useInventory', () => ({
  useItems: () => ({ data: [], isPending: false, isError: false, error: null }),
}));
vi.mock('../hooks/useDashboard', () => ({
  useDashboardHoy: () => hoyHook(),
  useDashboardEquipos: (rango: unknown) => {
    equiposMock(rango);
    return idle;
  },
  useDashboardSummary: () => idle,
  useHallazgosAbiertosResumen: () => idle,
  useHallazgosRecientes: () => idle,
  useHallazgosTendencia: () => idle,
  useHorasFacturables: () => idle,
  useMantencionesProximas: () => idle,
  useTrabajosExtraordinariosMensual: () => idle,
}));

import { DashboardView } from './DashboardView';

const mockHoy = (value: object) =>
  hoyHook.mockReturnValue({ isPending: false, isError: false, error: null, refetch: vi.fn(), ...value });

beforeEach(() => {
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
});
