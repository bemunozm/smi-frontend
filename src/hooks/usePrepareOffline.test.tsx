import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, renderHook } from '@testing-library/react';

const {
  equipmentListMock,
  operatorListMock,
  listMineMock,
  listHallazgosMock,
  listTrabajosMock,
  listHorometroMock,
  branchListMock,
  categoryListMock,
  itemsListMock,
  ordenesListMock,
  actividadesListMock,
  umbralesListMock,
} = vi.hoisted(() => ({
  equipmentListMock: vi.fn(),
  operatorListMock: vi.fn(),
  listMineMock: vi.fn(),
  listHallazgosMock: vi.fn(),
  listTrabajosMock: vi.fn(),
  listHorometroMock: vi.fn(),
  branchListMock: vi.fn(),
  categoryListMock: vi.fn(),
  itemsListMock: vi.fn(),
  ordenesListMock: vi.fn(),
  actividadesListMock: vi.fn(),
  umbralesListMock: vi.fn(),
}));

vi.mock('../api/EquipmentAPI', () => ({ EquipmentAPI: { list: equipmentListMock } }));
vi.mock('../api/OperatorAPI', () => ({ OperatorAPI: { list: operatorListMock } }));
vi.mock('../api/ShiftCardAPI', () => ({ ShiftCardAPI: { listMine: listMineMock } }));
vi.mock('../api/HallazgosAPI', () => ({ listHallazgos: listHallazgosMock }));
vi.mock('../api/TrabajosExtraAPI', () => ({ listTrabajosExtra: listTrabajosMock }));
vi.mock('../api/HorometroAPI', () => ({ listHorometro: listHorometroMock }));
vi.mock('../api/BranchAPI', () => ({ BranchAPI: { list: branchListMock } }));
vi.mock('../api/CategoryAPI', () => ({ CategoryAPI: { list: categoryListMock } }));
vi.mock('../api/InventoryAPI', () => ({ InventoryAPI: { listItems: itemsListMock } }));
vi.mock('../api/MantenimientoAPI', () => ({
  OrdenesAPI: { list: ordenesListMock },
  ActividadesAPI: { list: actividadesListMock },
  UmbralesAPI: { list: umbralesListMock },
}));

import { usePrepareOffline } from './usePrepareOffline';
import { queryClient } from '../lib/query-client';
import {
  ACTIVIDADES_KEY,
  BRANCHES_KEY,
  EQUIPMENT_KEY,
  HALLAZGOS_KEY,
  HOROMETRO_KEY,
  INVENTORY_KEY,
  OPERATORS_KEY,
  ORDENES_KEY,
  SHIFT_CARDS_MINE_KEY,
  TRABAJOS_EXTRA_KEY,
  UMBRALES_KEY,
} from '../lib/query-keys';
import { ROLES } from '../types/roles';

beforeEach(() => {
  equipmentListMock.mockResolvedValue([{ id: 'eq-1' }]);
  operatorListMock.mockResolvedValue([]);
  listMineMock.mockResolvedValue([]);
  listHallazgosMock.mockResolvedValue([{ id: 'h-1' }]);
  listTrabajosMock.mockResolvedValue([{ id: 't-1' }]);
  listHorometroMock.mockResolvedValue([{ id: 'l-1' }]);
  branchListMock.mockResolvedValue([{ id: 'br-1' }]);
  categoryListMock.mockResolvedValue([{ id: 'cat-1' }]);
  itemsListMock.mockResolvedValue([{ id: 'it-1' }]);
  ordenesListMock.mockResolvedValue([{ id: 'ot-1' }]);
  actividadesListMock.mockResolvedValue([{ id: 'ac-1' }]);
  umbralesListMock.mockResolvedValue([{ id: 'um-1' }]);
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

describe('usePrepareOffline por rol', () => {
  async function preparar(role: Parameters<typeof usePrepareOffline>[0]) {
    const { result } = renderHook(() => usePrepareOffline(role));
    await act(async () => {
      await result.current.handlePreparar();
    });
    return result.current.resultadoPrep!;
  }

  it('MANTENEDOR: equipos, sucursales, operadores, inventario y mantenimiento, bajo las keys que usan las pantallas', async () => {
    const resultado = await preparar(ROLES.MANTENEDOR);

    expect(resultado).toMatchObject({
      equipment: 'ok',
      branches: 'ok',
      operators: 'ok',
      inventory: 'ok',
      maintenance: 'ok',
    });
    expect(queryClient.getQueryData(EQUIPMENT_KEY)).toEqual([{ id: 'eq-1' }]);
    expect(queryClient.getQueryData([...BRANCHES_KEY, { isActive: true }])).toEqual([{ id: 'br-1' }]);
    expect(queryClient.getQueryData([...OPERATORS_KEY, { isActive: true }])).toEqual([]);
    expect(queryClient.getQueryData([...INVENTORY_KEY, 'items', { type: 'SUPPLY', isActive: true }])).toEqual([{ id: 'it-1' }]);
    expect(queryClient.getQueryData([...INVENTORY_KEY, 'items', { type: 'PART', isActive: true }])).toEqual([{ id: 'it-1' }]);
    expect(queryClient.getQueryData([...INVENTORY_KEY, 'categories', { type: 'PART' }])).toEqual([{ id: 'cat-1' }]);
    expect(queryClient.getQueryData([...ORDENES_KEY, 'TODAS'])).toEqual([{ id: 'ot-1' }]);
    expect(queryClient.getQueryData(ACTIVIDADES_KEY)).toEqual([{ id: 'ac-1' }]);
    expect(queryClient.getQueryData(UMBRALES_KEY)).toEqual([{ id: 'um-1' }]);
  });

  it('MANTENEDOR no ve Terreno: no pide tarjetas, hallazgos, trabajos ni horómetro', async () => {
    const resultado = await preparar(ROLES.MANTENEDOR);

    expect(listMineMock).not.toHaveBeenCalled();
    expect(listHallazgosMock).not.toHaveBeenCalled();
    expect(listTrabajosMock).not.toHaveBeenCalled();
    expect(listHorometroMock).not.toHaveBeenCalled();
    expect(resultado.shiftCards).toBeUndefined();
    expect(resultado.hallazgos).toBeUndefined();
  });

  it('SUPERVISOR: Terreno más las listas de Equipos e Inventario, pero no mantenimiento', async () => {
    const resultado = await preparar(ROLES.SUPERVISOR);

    expect(resultado).toMatchObject({ equipment: 'ok', inventory: 'ok', shiftCards: 'ok', hallazgos: 'ok' });
    expect(resultado.maintenance).toBeUndefined();
    expect(ordenesListMock).not.toHaveBeenCalled();
  });

  it('ADMIN: todas las listas', async () => {
    const resultado = await preparar(ROLES.ADMIN);

    for (const key of ['equipment', 'branches', 'operators', 'inventory', 'maintenance', 'shiftCards', 'hallazgos', 'trabajosExtra', 'horometro'] as const) {
      expect(resultado[key], key).toBe('ok');
    }
  });

  it('un fallo en las listas de una pantalla se reporta como error sin tumbar el resto', async () => {
    itemsListMock.mockRejectedValue(new Error('network'));

    const resultado = await preparar(ROLES.ADMIN);

    expect(resultado.inventory).toBe('error');
    expect(resultado.maintenance).toBe('ok');
    expect(resultado.equipment).toBe('ok');
  });

  it('una lista cuenta como ok solo si TODAS sus peticiones lo están', async () => {
    umbralesListMock.mockRejectedValue(new Error('network'));

    const resultado = await preparar(ROLES.MANTENEDOR);

    expect(resultado.maintenance).toBe('error');
  });
});
