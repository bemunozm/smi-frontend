import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import type { ShiftCardResponse, ShiftReportListItem } from '../../types/shift';

const { cardsHook, rol } = vi.hoisted(() => ({
  cardsHook: vi.fn(),
  rol: { value: 'ADMIN' as 'ADMIN' | 'SECRETARIA' },
}));

vi.mock('../../hooks/useShiftReports', () => ({ useShiftReportCards: () => cardsHook() }));
vi.mock('../../hooks/useShiftCards', () => ({ useCambiosTarjeta: () => ({ data: [], isLoading: false }) }));
vi.mock('../../hooks/useCurrentUser', () => ({ useCurrentUser: () => ({ user: { id: 'admin_1' } }) }));
vi.mock('../../offline/useOutboxOps', () => ({ useOutboxOps: () => [] }));
vi.mock('../../hooks/useOperators', () => ({
  useOperators: () => ({ data: [{ id: 'op_1', name: 'Juan Rojas', isActive: true }] }),
}));
vi.mock('../../hooks/usePermissions', async () => {
  const { canWrite } = await import('../../lib/permissions');
  return {
    usePermissions: () => ({
      role: rol.value,
      can: (action: Parameters<typeof canWrite>[1]) => canWrite(rol.value, action),
    }),
  };
});

import { RegistroTurnoModal } from './RegistroTurnoModal';

const REPORTE: ShiftReportListItem = {
  id: 'r1',
  shiftDate: '2026-10-21',
  shiftType: 'DIURNO',
  supervisor: 'Jorge SMI',
  cardCount: 1,
  emailStatus: 'SENT',
  fileName: 'reporte.pdf',
  createdAt: '2026-10-21T18:05:00.000Z',
};

const TARJETA: ShiftCardResponse = {
  id: 'c1',
  equipoId: 'e1',
  equipo: { internalCode: 'BD-005', type: 'Bulldozer', controlUnit: 'HOURS' },
  operatorId: 'op_1',
  operatorName: 'Juan Rojas',
  supervisorId: 'sup_1',
  supervisorName: 'Jorge SMI',
  shift: null,
  valorInicial: 2100,
  valorFinal: 2108.5,
  horasMaquina: 8.5,
  fuelLiters: 120,
  adBlue: true,
  adBlueLiters: 10,
  pumpPhotoUrl: null,
  observaciones: 'Sin novedades',
  belowPreviousReading: false,
  fecha: '2026-10-21T11:00:00.000Z',
  fechaSalida: '2026-10-21T19:30:00.000Z',
  createdAt: '2026-10-21T11:00:00.000Z',
  closedAt: '2026-10-21T19:30:00.000Z',
};

function renderModal() {
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <RegistroTurnoModal reporte={REPORTE} onClose={() => {}} />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  rol.value = 'ADMIN';
  cardsHook.mockReturnValue({ data: [TARJETA], isPending: false, isError: false, error: null });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('RegistroTurnoModal', () => {
  it('muestra las tarjetas del turno: equipo, operador, horómetros, combustible y AdBlue', () => {
    renderModal();
    const tarjeta = screen.getByTestId('tarjeta-c1');
    expect(within(tarjeta).getByText('BD-005')).toBeTruthy();
    expect(within(tarjeta).getByText('Bulldozer · Juan Rojas')).toBeTruthy();
    expect(within(tarjeta).getByText('8,5 h')).toBeTruthy();
    expect(within(tarjeta).getByText('120 L')).toBeTruthy();
    expect(within(tarjeta).getByText('10 L')).toBeTruthy();
    expect(within(tarjeta).getByText('Sin novedades')).toBeTruthy();
    expect(screen.getByRole('link', { name: /Descargar PDF/ }).getAttribute('href')).toContain(
      '/api/shift-reports/r1/file',
    );
  });

  it('el administrador abre el editor de Terreno con los datos de la tarjeta', () => {
    renderModal();
    fireEvent.click(within(screen.getByTestId('tarjeta-c1')).getByRole('button', { name: /Editar/ }));
    expect(screen.getByText('Editar · BD-005')).toBeTruthy();
    expect(screen.getByRole('button', { name: /Volver al registro/ })).toBeTruthy();
  });

  it('una camioneta se corrige sin operador: kilometraje en km y se puede guardar', () => {
    const camioneta: ShiftCardResponse = {
      ...TARJETA,
      id: 'c2',
      equipo: { internalCode: 'CN-007', type: 'Camioneta', controlUnit: 'KM', equipmentClass: 'LIGHT' },
      operatorId: null,
      operatorName: '',
      valorInicial: 15000,
      valorFinal: 15180,
      adBlue: false,
      adBlueLiters: null,
    };
    cardsHook.mockReturnValue({ data: [camioneta], isPending: false, isError: false, error: null });
    renderModal();
    fireEvent.click(within(screen.getByTestId('tarjeta-c2')).getByRole('button', { name: /Editar/ }));

    expect(screen.queryByText('Operador')).toBeNull();
    expect(screen.getByText('Kilometraje inicial')).toBeTruthy();
    fireEvent.change(screen.getByDisplayValue('15180'), { target: { value: '15190' } });
    const guardar = screen.getByRole('button', { name: /Guardar cambios/ }) as HTMLButtonElement;
    expect(guardar.disabled).toBe(false);
  });

  it('SECRETARIA ve el registro pero no lo edita', () => {
    rol.value = 'SECRETARIA';
    renderModal();
    expect(within(screen.getByTestId('tarjeta-c1')).queryByRole('button', { name: /Editar/ })).toBeNull();
  });
});
