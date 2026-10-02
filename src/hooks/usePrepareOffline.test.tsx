import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, renderHook } from '@testing-library/react';

const {
  equipmentListMock,
  operatorListMock,
  listMineMock,
  listHallazgosMock,
  listTrabajosMock,
  listHorometroMock,
} = vi.hoisted(() => ({
  equipmentListMock: vi.fn(),
  operatorListMock: vi.fn(),
  listMineMock: vi.fn(),
  listHallazgosMock: vi.fn(),
  listTrabajosMock: vi.fn(),
  listHorometroMock: vi.fn(),
}));

vi.mock('../api/EquipmentAPI', () => ({ EquipmentAPI: { list: equipmentListMock } }));
vi.mock('../api/OperatorAPI', () => ({ OperatorAPI: { list: operatorListMock } }));
vi.mock('../api/ShiftCardAPI', () => ({ ShiftCardAPI: { listMine: listMineMock } }));
vi.mock('../api/HallazgosAPI', () => ({ listHallazgos: listHallazgosMock }));
vi.mock('../api/TrabajosExtraAPI', () => ({ listTrabajosExtra: listTrabajosMock }));
vi.mock('../api/HorometroAPI', () => ({ listHorometro: listHorometroMock }));

import { usePrepareOffline } from './usePrepareOffline';
import { queryClient } from '../lib/query-client';
import { HALLAZGOS_KEY, HOROMETRO_KEY, SHIFT_CARDS_MINE_KEY, TRABAJOS_EXTRA_KEY } from '../lib/query-keys';

beforeEach(() => {
  equipmentListMock.mockResolvedValue([{ id: 'eq-1' }]);
  operatorListMock.mockResolvedValue([]);
  listMineMock.mockResolvedValue([]);
  listHallazgosMock.mockResolvedValue([{ id: 'h-1' }]);
  listTrabajosMock.mockResolvedValue([{ id: 't-1' }]);
  listHorometroMock.mockResolvedValue([{ id: 'l-1' }]);
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  queryClient.clear();
});

describe('usePrepareOffline', () => {
  it('precarga también hallazgos, trabajos extra y horómetro bajo las query keys compartidas', async () => {
    const { result } = renderHook(() => usePrepareOffline());

    await act(async () => {
      await result.current.handlePreparar();
    });

    expect(listHallazgosMock).toHaveBeenCalledTimes(1);
    expect(listTrabajosMock).toHaveBeenCalledTimes(1);
    expect(listHorometroMock).toHaveBeenCalledTimes(1);
    expect(queryClient.getQueryData(HALLAZGOS_KEY)).toEqual([{ id: 'h-1' }]);
    expect(queryClient.getQueryData(TRABAJOS_EXTRA_KEY)).toEqual([{ id: 't-1' }]);
    expect(queryClient.getQueryData(HOROMETRO_KEY)).toEqual([{ id: 'l-1' }]);
    expect(queryClient.getQueryData(SHIFT_CARDS_MINE_KEY)).toEqual([]);
    expect(result.current.resultadoPrep).toMatchObject({
      equipment: 'ok',
      operators: 'ok',
      shiftCards: 'ok',
      hallazgos: 'ok',
      trabajosExtra: 'ok',
      horometro: 'ok',
    });
  });

  it('un fallo en una lista se reporta como error sin tumbar las demás', async () => {
    listTrabajosMock.mockRejectedValue(new Error('network'));
    const { result } = renderHook(() => usePrepareOffline());

    await act(async () => {
      await result.current.handlePreparar();
    });

    expect(result.current.resultadoPrep).toMatchObject({
      hallazgos: 'ok',
      trabajosExtra: 'error',
      horometro: 'ok',
      equipment: 'ok',
    });
    expect(result.current.preparando).toBe(false);
  });
});
