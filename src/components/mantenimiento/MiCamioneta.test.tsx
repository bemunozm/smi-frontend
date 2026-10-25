import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { MiCamioneta } from './MiCamioneta';
import type { ShiftCardResponse } from '../../types/shift';

const { equipmentListMock, listMineMock, enqueueOpenCardMock } = vi.hoisted(() => ({
  equipmentListMock: vi.fn(),
  listMineMock: vi.fn(),
  enqueueOpenCardMock: vi.fn(),
}));

vi.mock('../../api/EquipmentAPI', () => ({ EquipmentAPI: { list: equipmentListMock } }));
vi.mock('../../api/ShiftCardAPI', () => ({ ShiftCardAPI: { listMine: listMineMock } }));
vi.mock('../../offline/outbox', () => ({ enqueueOpenCard: enqueueOpenCardMock, enqueueCloseCard: vi.fn() }));
vi.mock('../../offline/useOutboxOps', () => ({ useOutboxOps: () => [] }));
vi.mock('../../hooks/useCurrentUser', () => ({
  useCurrentUser: () => ({ user: { id: 'mant_1', name: 'Mario Mantenedor', email: 'm@smi.local' }, role: 'MANTENEDOR' }),
}));
vi.mock('@heroui/react', async (original) => ({
  ...(await original<typeof import('@heroui/react')>()),
  toast: { danger: vi.fn(), success: vi.fn() },
}));

const CAMIONETA = {
  id: 'eq_l1',
  internalCode: 'CM-001',
  type: 'Camioneta',
  licensePlate: 'ABCD-12',
  status: 'OPERATIONAL',
  equipmentClass: 'LIGHT',
  currentHourmeter: null,
  currentMileage: 45120,
  openShift: null,
};

function tarjeta(supervisorId: string): ShiftCardResponse {
  return {
    id: `card_${supervisorId}`,
    equipoId: 'eq_l1',
    equipo: { internalCode: 'CM-001', type: 'Camioneta', controlUnit: 'KM', equipmentClass: 'LIGHT' },
    operatorId: null,
    operatorName: '',
    supervisorId,
    supervisorName: supervisorId === 'mant_1' ? 'Mario Mantenedor' : 'Marta Díaz',
    shift: { id: 'sh_1', date: '2026-10-24', type: 'DIURNO', exitReports: [] },
    valorInicial: 45120,
    valorFinal: null,
    horasMaquina: null,
    fuelLiters: null,
    adBlue: false,
    adBlueLiters: null,
    pumpPhotoUrl: null,
    observaciones: null,
    belowPreviousReading: false,
    fecha: '2026-10-24T11:00:00.000Z',
    fechaSalida: null,
    createdAt: '2026-10-24T11:00:00.000Z',
    closedAt: null,
  };
}

function renderCard() {
  return render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MiCamioneta />
    </QueryClientProvider>,
  );
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('MiCamioneta (mantenedor)', () => {
  it('sin camioneta abierta: la abre con el km de la camioneta y sin operador', async () => {
    equipmentListMock.mockResolvedValue([CAMIONETA]);
    listMineMock.mockResolvedValue([]);
    enqueueOpenCardMock.mockResolvedValue(undefined);
    renderCard();

    fireEvent.click(await screen.findByRole('button', { name: /Usar camioneta/ }));
    const boton = await screen.findByRole('button', { name: /Empezar a usarla/ });
    await waitFor(() => expect(boton.hasAttribute('disabled')).toBe(false));
    fireEvent.click(boton);

    await waitFor(() => expect(enqueueOpenCardMock).toHaveBeenCalledTimes(1));
    const [userId, payload] = enqueueOpenCardMock.mock.calls[0]!;
    expect(userId).toBe('mant_1');
    expect(payload).toMatchObject({ equipoId: 'eq_l1', valorInicial: 45120 });
    expect('operatorId' in payload).toBe(false);
  });

  it('con su camioneta abierta: la muestra y ofrece cerrarla al cargar combustible', async () => {
    equipmentListMock.mockResolvedValue([{ ...CAMIONETA, openShift: { supervisorName: 'Mario Mantenedor' } }]);
    listMineMock.mockResolvedValue([tarjeta('mant_1')]);
    renderCard();

    expect(await screen.findByRole('button', { name: /Cargar combustible y cerrar/ })).toBeTruthy();
    expect(screen.getByText('CM-001')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /Cargar combustible y cerrar/ }));
    expect(await screen.findByText('Kilometraje final')).toBeTruthy();
    expect(screen.getByText('Falta la foto del surtidor para cerrar.')).toBeTruthy();
  });

  it('la camioneta abierta por OTRA persona no es «mi camioneta»', async () => {
    equipmentListMock.mockResolvedValue([{ ...CAMIONETA, openShift: { supervisorName: 'Marta Díaz' } }]);
    listMineMock.mockResolvedValue([tarjeta('sup_2')]);
    renderCard();

    expect(await screen.findByRole('button', { name: /Usar camioneta/ })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Cargar combustible y cerrar/ })).toBeNull();
  });
});
