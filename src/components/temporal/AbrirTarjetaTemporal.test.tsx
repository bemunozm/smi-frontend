import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';

import { AbrirTarjetaTemporal } from './AbrirTarjetaTemporal';
import type { Equipment } from '../../types/equipment';

const { enqueueOpenCardMock } = vi.hoisted(() => ({ enqueueOpenCardMock: vi.fn() }));

vi.mock('../../offline/outbox', () => ({ enqueueOpenCard: enqueueOpenCardMock }));
vi.mock('../../hooks/useOperators', () => ({
  useOperators: () => ({ data: [{ id: 'op_1', name: 'Juan Rojas' }], isPending: false }),
}));
vi.mock('../../hooks/useCurrentUser', () => ({ useCurrentUser: () => ({ user: { id: 'tmp_1' } }) }));
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
} as unknown as Equipment;

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('AbrirTarjetaTemporal', () => {
  it('elige el operador con el selector del kit de Terreno y viaja en la apertura', async () => {
    enqueueOpenCardMock.mockResolvedValue(undefined);
    render(<AbrirTarjetaTemporal disponibles={[CARGADOR]} userId="tmp_1" />);

    fireEvent.click(screen.getByLabelText('Equipo'));
    fireEvent.click(within(screen.getByRole('listbox')).getByRole('option', { name: /CA-003/ }));
    fireEvent.click(screen.getByLabelText('Operador'));
    fireEvent.click(within(screen.getByRole('listbox')).getByRole('option', { name: 'Juan Rojas' }));
    fireEvent.click(screen.getByRole('button', { name: /Abrir equipo/ }));

    await waitFor(() => expect(enqueueOpenCardMock).toHaveBeenCalled());
    expect(enqueueOpenCardMock.mock.calls[0][1]).toMatchObject({ equipoId: 'eq_1', operatorId: 'op_1' });
  });
});
