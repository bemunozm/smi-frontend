import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';

import { SupervisorTemporalView } from './SupervisorTemporalView';
import type { OutboxOp } from '../offline/db';
import type { ShiftCardResponse } from '../types/shift';

const { equipmentListMock, listMineMock, opsMock } = vi.hoisted(() => ({
  equipmentListMock: vi.fn(),
  listMineMock: vi.fn(),
  opsMock: { current: [] as unknown[] },
}));

vi.mock('../api/EquipmentAPI', () => ({ EquipmentAPI: { list: equipmentListMock } }));
vi.mock('../api/ShiftCardAPI', () => ({ ShiftCardAPI: { listMine: listMineMock } }));
vi.mock('../offline/outbox', () => ({ enqueueOpenCard: vi.fn(), enqueueCloseCard: vi.fn() }));
vi.mock('../offline/useOutboxOps', () => ({ useOutboxOps: () => opsMock.current }));
vi.mock('../hooks/useOperators', () => ({ useOperators: () => ({ data: [], isPending: false }) }));
vi.mock('../hooks/useCurrentUser', () => ({
  useCurrentUser: () => ({
    user: { id: 'tmp_1', name: 'Pedro Soto', email: 'p@smi.local' },
    role: 'SUPERVISOR_TEMPORAL',
  }),
}));
vi.mock('@heroui/react', async (original) => ({
  ...(await original<typeof import('@heroui/react')>()),
  toast: { danger: vi.fn(), success: vi.fn() },
}));

const CARGADOR = {
  id: 'eq_1',
  internalCode: 'CA-003',
  type: 'Cargador',
  brand: 'SEM',
  model: '656F',
  status: 'OPERATIONAL',
  equipmentClass: 'HEAVY',
  currentHourmeter: 1200,
  currentMileage: null,
  openShift: { supervisorName: 'Pedro Soto' },
};

function tarjeta(id = 'card_1'): ShiftCardResponse {
  return {
    id,
    equipoId: 'eq_1',
    equipo: { internalCode: 'CA-003', type: 'Cargador', controlUnit: 'HOURS', equipmentClass: 'HEAVY' },
    operatorId: 'op_1',
    operatorName: 'Juan Rojas',
    supervisorId: 'tmp_1',
    supervisorName: 'Pedro Soto',
    shift: null,
    valorInicial: 1200,
    valorFinal: null,
    horasMaquina: null,
    fuelLiters: null,
    adBlue: false,
    adBlueLiters: null,
    pumpPhotoUrl: null,
    observaciones: null,
    belowPreviousReading: false,
    fecha: '2026-11-24T11:00:00.000Z',
    fechaSalida: null,
    createdAt: '2026-11-24T11:00:00.000Z',
    closedAt: null,
  };
}

function renderView() {
  return render(
    <MemoryRouter>
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <SupervisorTemporalView />
      </QueryClientProvider>
    </MemoryRouter>,
  );
}

const botonCerrar = () => screen.getByRole('button', { name: /Cerrar y generar informe/ });

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  opsMock.current = [];
});

describe('SupervisorTemporalView', () => {
  it('deshabilita «Cerrar y generar informe» sin tarjetas abiertas', async () => {
    equipmentListMock.mockResolvedValue([{ ...CARGADOR, openShift: null }]);
    listMineMock.mockResolvedValue([]);
    renderView();
    await waitFor(() => expect(listMineMock).toHaveBeenCalled());
    expect(await screen.findByText(/No tienes equipos abiertos/)).toBeTruthy();
    expect(botonCerrar().hasAttribute('disabled')).toBe(true);
    expect(screen.getByRole('button', { name: /Abrir equipo/ })).toBeTruthy();
  });

  it('lista las tarjetas abiertas con código y nombre, y habilita el cierre', async () => {
    equipmentListMock.mockResolvedValue([CARGADOR]);
    listMineMock.mockResolvedValue([tarjeta()]);
    renderView();
    expect(await screen.findByText('CA-003')).toBeTruthy();
    expect(screen.getByText(/Cargador SEM 656F/)).toBeTruthy();
    expect(botonCerrar().hasAttribute('disabled')).toBe(false);
  });

  it('una tarjeta que ya va en un informe pendiente de envío no se lista', async () => {
    equipmentListMock.mockResolvedValue([CARGADOR]);
    listMineMock.mockResolvedValue([tarjeta()]);
    opsMock.current = [
      {
        id: 'op_inf',
        type: 'httpWrite',
        endpoint: 'informeTemporal.create',
        status: 'pending',
        body: { cierres: [{ cardId: 'card_1' }] },
        params: {},
      },
    ] as unknown as OutboxOp[];
    renderView();
    expect(await screen.findByText(/pendiente de envío/)).toBeTruthy();
    expect(screen.queryByText('CA-003')).toBeNull();
    expect(botonCerrar().hasAttribute('disabled')).toBe(true);
  });
});
