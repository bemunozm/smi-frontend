import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const { listMock, resumenMock, getByIdMock, createMock, updateStatusMock, removeMock, assignMock } = vi.hoisted(() => ({
  listMock: vi.fn(),
  resumenMock: vi.fn(),
  getByIdMock: vi.fn(),
  createMock: vi.fn(),
  updateStatusMock: vi.fn(),
  removeMock: vi.fn(),
  assignMock: vi.fn(),
}));

vi.mock('../api/EquipmentAPI', () => ({
  EquipmentAPI: {
    list: listMock,
    resumen: resumenMock,
    getById: getByIdMock,
    create: createMock,
    update: vi.fn(),
    updateStatus: updateStatusMock,
    remove: removeMock,
    assign: assignMock,
  },
}));

// El hook llama a `toast.success`/`toast.danger` — no importa la UI real de
// HeroUI acá, solo que la función exista y no reviente el test.
vi.mock('@heroui/react', () => ({
  toast: { success: vi.fn(), danger: vi.fn() },
}));

import {
  useAssignEquipment,
  useCreateEquipment,
  useDeleteEquipment,
  useEquipment,
  useEquipmentDetail,
  useResumenFleet,
  useUpdateEquipmentStatus,
} from './useEquipment';

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const EQUIPMENT = {
  id: 'eq_1',
  internalCode: 'EX-001',
  licensePlate: null,
  equipmentClass: 'HEAVY',
  type: 'Excavadora',
  brand: 'Caterpillar',
  model: '336',
  year: 2019,
  controlUnit: 'HOURS',
  currentHourmeter: 1200,
  currentMileage: null,
  status: 'OPERATIONAL',
  homeBranchId: null,
  photoUrl: null,
  technicalInspectionExpiry: null,
  insuranceExpiry: null,
  operator: null,
  supervisor: null,
  inUse: false,
  currentFuelLevel: null,
  openShift: null,
  documents: {
    technicalInspection: { expiry: null, status: 'SIN_DATO', daysToExpiry: null },
    insurance: { expiry: null, status: 'SIN_DATO', daysToExpiry: null },
  },
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

function withQueryClient(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

describe('useEquipment', () => {
  it('pide la lista sin filtros y la cachea bajo la queryKey retrocompatible ["equipment"]', async () => {
    listMock.mockResolvedValueOnce([EQUIPMENT]);
    const queryClient = new QueryClient();

    const { result } = renderHook(() => useEquipment(), { wrapper: withQueryClient(queryClient) });

    await waitFor(() => expect(result.current.data).toEqual([EQUIPMENT]));
    expect(listMock).toHaveBeenCalledWith({});
    // Query key retrocompatible: la consumen Terreno e Inventario sin filtros.
    expect(queryClient.getQueryData(['equipment'])).toEqual([EQUIPMENT]);
  });

  it('con filtros, cachea bajo una queryKey distinta a la lista sin filtrar', async () => {
    listMock.mockResolvedValue([EQUIPMENT]);
    const queryClient = new QueryClient();

    const { result } = renderHook(() => useEquipment({ equipmentClass: 'HEAVY' }), {
      wrapper: withQueryClient(queryClient),
    });

    await waitFor(() => expect(result.current.data).toEqual([EQUIPMENT]));
    expect(listMock).toHaveBeenCalledWith({ equipmentClass: 'HEAVY' });
    expect(queryClient.getQueryData(['equipment'])).toBeUndefined();
    expect(queryClient.getQueryData(['equipment', { equipmentClass: 'HEAVY' }])).toEqual([EQUIPMENT]);
  });
});

describe('useResumenFleet', () => {
  it('expone el resumen agregado por estado que arma el backend', async () => {
    resumenMock.mockResolvedValueOnce({
      total: 2,
      disponibles: 1,
      porEstado: { OPERATIONAL: 1, IN_WORKSHOP: 1, OUT_OF_SERVICE: 0 },
    });
    const queryClient = new QueryClient();

    const { result } = renderHook(() => useResumenFleet(), { wrapper: withQueryClient(queryClient) });

    await waitFor(() => expect(result.current.data?.total).toBe(2));
  });
});

describe('useEquipmentDetail', () => {
  it('no dispara la query cuando el id viene vacío', () => {
    const queryClient = new QueryClient();

    const { result } = renderHook(() => useEquipmentDetail(''), { wrapper: withQueryClient(queryClient) });

    expect(result.current.fetchStatus).toBe('idle');
    expect(getByIdMock).not.toHaveBeenCalled();
  });

  it('pide la ficha cuando el id viene informado', async () => {
    getByIdMock.mockResolvedValueOnce({
      ...EQUIPMENT,
      homeBranch: null,
      _count: { combustibles: 0, horometros: 0, trabajosExtra: 0, hallazgos: 0, stockMovements: 0 },
      stockMovements: [],
    });
    const queryClient = new QueryClient();

    const { result } = renderHook(() => useEquipmentDetail('eq_1'), { wrapper: withQueryClient(queryClient) });

    await waitFor(() => expect(result.current.data?.id).toBe('eq_1'));
    expect(getByIdMock).toHaveBeenCalledWith('eq_1');
  });
});

describe('useCreateEquipment', () => {
  it('invalida el árbol ["equipment"] (lista + resumen + fichas) al crear', async () => {
    createMock.mockResolvedValueOnce(EQUIPMENT);
    const queryClient = new QueryClient();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(() => useCreateEquipment(), { wrapper: withQueryClient(queryClient) });

    result.current.mutate({
      internalCode: 'EX-001',
      equipmentClass: 'HEAVY',
      type: 'Excavadora',
      brand: 'Caterpillar',
      model: '336',
      controlUnit: 'HOURS',
      status: 'OPERATIONAL',
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['equipment'] });
  });
});

describe('useUpdateEquipmentStatus', () => {
  it('llama a EquipmentAPI.updateStatus con el id y el nuevo estado', async () => {
    updateStatusMock.mockResolvedValueOnce({ ...EQUIPMENT, status: 'IN_WORKSHOP' });
    const queryClient = new QueryClient();

    const { result } = renderHook(() => useUpdateEquipmentStatus(), { wrapper: withQueryClient(queryClient) });

    result.current.mutate({ id: 'eq_1', status: 'IN_WORKSHOP' });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(updateStatusMock).toHaveBeenCalledWith('eq_1', 'IN_WORKSHOP');
  });
});

describe('useAssignEquipment', () => {
  it('llama a EquipmentAPI.assign con el id y el body de asignación, e invalida el árbol ["equipment"]', async () => {
    assignMock.mockResolvedValueOnce({ ...EQUIPMENT, operator: { id: 'u_op', name: 'Pedro Soto' } });
    const queryClient = new QueryClient();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(() => useAssignEquipment(), { wrapper: withQueryClient(queryClient) });

    result.current.mutate({ id: 'eq_1', input: { operatorId: 'u_op', supervisorId: null } });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(assignMock).toHaveBeenCalledWith('eq_1', { operatorId: 'u_op', supervisorId: null });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['equipment'] });
  });
});

describe('useDeleteEquipment', () => {
  it('invalida el árbol ["equipment"] al eliminar', async () => {
    removeMock.mockResolvedValueOnce(undefined);
    const queryClient = new QueryClient();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(() => useDeleteEquipment(), { wrapper: withQueryClient(queryClient) });

    result.current.mutate('eq_1');

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(removeMock).toHaveBeenCalledWith('eq_1');
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['equipment'] });
  });
});
