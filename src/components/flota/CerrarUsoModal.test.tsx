import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, act } from '@testing-library/react';

import { CerrarUsoModal } from './CerrarUsoModal';
import { useCambiarEstadoEquipo } from './useCambiarEstadoEquipo';
import type { Equipment, OpenShift } from '../../types/equipment';

const cerrarMock = vi.fn();
const statusMock = vi.fn();
let role: string | null = 'ADMIN';

vi.mock('../../hooks/useShiftCards', () => ({
  useAdminCloseShiftCard: () => ({ mutate: cerrarMock, isPending: false }),
}));
vi.mock('../../hooks/useEquipment', () => ({
  useUpdateEquipmentStatus: () => ({ mutate: statusMock, isPending: false }),
}));
vi.mock('../../hooks/useCurrentUser', () => ({
  useCurrentUser: () => ({ role }),
}));

afterEach(cleanup);

const OPEN_SHIFT: OpenShift = {
  id: 'card_1',
  valorInicial: 14676.7,
  operador: 'Jairo Cortes',
  operatorId: 'op_1',
  turno: 'DIURNO',
  fecha: '2026-11-13T13:13:00.000Z',
  supervisorName: 'Victor Araya',
  shiftId: 'shift_1',
};

const EQUIPO = {
  id: 'eq_1',
  internalCode: 'SANY 02',
  licensePlate: null,
  equipmentClass: 'HEAVY',
  type: 'Cargador',
  brand: 'Sany',
  model: '956H5',
  year: 2022,
  controlUnit: 'HOURS',
  currentHourmeter: 14676.7,
  currentMileage: null,
  status: 'OPERATIONAL',
  homeBranchId: null,
  photoUrl: null,
  operator: null,
  supervisor: null,
  inUse: false,
  currentFuelLevel: null,
  openShift: OPEN_SHIFT,
  documentsAlert: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
} as Equipment & { openShift: OpenShift };

function wrapper({ children }: { children: React.ReactNode }) {
  return <QueryClientProvider client={new QueryClient()}>{children}</QueryClientProvider>;
}

describe('CerrarUsoModal', () => {
  beforeEach(() => {
    cerrarMock.mockReset();
    statusMock.mockReset();
    role = 'ADMIN';
  });

  it('muestra quién lo tiene y cierra con la lectura inicial (0 h) por defecto', () => {
    const onClose = vi.fn();
    render(<CerrarUsoModal equipo={EQUIPO} onClose={onClose} />, { wrapper });

    expect(screen.getByText('Jairo Cortes')).toBeTruthy();
    expect(screen.getByText('Victor Araya')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar uso' }));

    expect(cerrarMock).toHaveBeenCalledWith(
      { id: 'card_1', equipoCodigo: 'SANY 02', input: { valorFinal: 14676.7, motivo: undefined } },
      expect.anything(),
    );
    expect(statusMock).not.toHaveBeenCalled();
  });

  it('con un estado nuevo, al cerrar el uso cambia también el estado', () => {
    const onClose = vi.fn();
    const onHecho = vi.fn();
    cerrarMock.mockImplementation((_vars, opts: { onSuccess: () => void }) => opts.onSuccess());
    statusMock.mockImplementation((_vars, opts: { onSuccess: () => void }) => opts.onSuccess());
    render(<CerrarUsoModal equipo={EQUIPO} nuevoEstado="OUT_OF_SERVICE" onClose={onClose} onHecho={onHecho} />, {
      wrapper,
    });

    fireEvent.click(screen.getByRole('button', { name: /Cerrar uso y marcar como Fuera de servicio/ }));

    expect(cerrarMock).toHaveBeenCalledWith(
      expect.objectContaining({
        input: { valorFinal: 14676.7, motivo: 'equipo marcado como fuera de servicio' },
      }),
      expect.anything(),
    );
    expect(statusMock).toHaveBeenCalledWith({ equipo: EQUIPO, status: 'OUT_OF_SERVICE' }, expect.anything());
    expect(onHecho).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('no deja cerrar con una lectura menor que la inicial', () => {
    render(<CerrarUsoModal equipo={EQUIPO} onClose={vi.fn()} />, { wrapper });

    fireEvent.change(screen.getByLabelText('Horómetro final (h)'), { target: { value: '100' } });

    expect(screen.getByRole('button', { name: 'Cerrar uso' }).hasAttribute('disabled')).toBe(true);
    expect(screen.getByText(/No puede ser menor que la lectura al abrir/)).toBeTruthy();
  });
});

describe('useCambiarEstadoEquipo', () => {
  beforeEach(() => {
    statusMock.mockReset();
    role = 'ADMIN';
  });

  it('el administrador que deja fuera de servicio un equipo en uso pasa por «Cerrar uso»', () => {
    const { result } = renderHook(() => useCambiarEstadoEquipo(), { wrapper });

    let via: string | undefined;
    act(() => {
      via = result.current.cambiar(EQUIPO, 'OUT_OF_SERVICE');
    });

    expect(via).toBe('ventana');
    expect(statusMock).not.toHaveBeenCalled();
    expect(result.current.modal).not.toBeNull();
  });

  it('sin uso en curso, o al volver a Operativo, cambia el estado directo', () => {
    const { result } = renderHook(() => useCambiarEstadoEquipo(), { wrapper });

    act(() => {
      result.current.cambiar({ ...EQUIPO, openShift: null }, 'OUT_OF_SERVICE');
      result.current.cambiar(EQUIPO, 'OPERATIONAL');
    });

    expect(statusMock).toHaveBeenCalledTimes(2);
    expect(result.current.modal).toBeNull();
  });

  it('el supervisor cambia el estado como antes (no cierra tarjetas ajenas)', () => {
    role = 'SUPERVISOR';
    const { result } = renderHook(() => useCambiarEstadoEquipo(), { wrapper });

    act(() => {
      result.current.cambiar(EQUIPO, 'IN_WORKSHOP');
    });

    expect(statusMock).toHaveBeenCalledWith({ equipo: EQUIPO, status: 'IN_WORKSHOP' }, undefined);
  });
});
