import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const { listMock, resumenMock, getByIdMock } = vi.hoisted(() => ({
  listMock: vi.fn(),
  resumenMock: vi.fn(),
  getByIdMock: vi.fn(),
}));

vi.mock('../api/EquipmentAPI', () => ({
  EquipmentAPI: { list: listMock, resumen: resumenMock, getById: getByIdMock },
}));

// Las escrituras van por la cola: se prueba lo que se encola (ver `test/office-write.ts`).
vi.mock('../offline/submit-write', async (importOriginal) =>
  (await import('../test/office-write')).conSubmitWriteFalso(await importOriginal()),
);

// El hook llama a `toast.success`/`toast.danger` — no importa la UI real de
// HeroUI acá, solo que la función exista y no reviente el test.
vi.mock('@heroui/react', () => ({
  toast: { success: vi.fn(), danger: vi.fn() },
}));

import { toast } from '@heroui/react';
import { DomainError } from '../lib/api-error';
import { OFFICE_WAIT_MS } from '../offline/submit-write';
import { encolado, enviado, submitWriteMock, ultimaEscritura } from '../test/office-write';
import type { Equipment } from '../types/equipment';
import {
  useAssignEquipment,
  useCreateEquipment,
  useDeleteEquipment,
  useEquipment,
  useEquipmentDetail,
  useResumenFleet,
  useSaveEquipment,
  useUpdateEquipment,
  useUpdateEquipmentStatus,
} from './useEquipment';

afterEach(() => {
  cleanup();
  vi.resetAllMocks();
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
  operator: null,
  supervisor: null,
  inUse: false,
  currentFuelLevel: null,
  openShift: null,
  documentsAlert: null,
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

const EQUIPO = EQUIPMENT as unknown as Equipment;

function wrapperNuevo() {
  return withQueryClient(new QueryClient());
}

describe('useCreateEquipment', () => {
  const input = {
    internalCode: 'EX-001',
    equipmentClass: 'HEAVY' as const,
    type: 'Excavadora',
    brand: 'Caterpillar',
    model: '336',
    controlUnit: 'HOURS' as const,
    status: 'OPERATIONAL' as const,
  };

  it('encola equipment.create con el id que genera el cliente en el body y la foto como archivo', async () => {
    submitWriteMock.mockResolvedValueOnce(enviado(EQUIPO));
    const foto = new File(['x'], 'foto.jpg', { type: 'image/jpeg' });
    const { result } = renderHook(() => useCreateEquipment(), { wrapper: wrapperNuevo() });

    result.current.mutate({ input, photo: foto });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const { endpoint, input: encolado_, options } = ultimaEscritura();
    expect(endpoint).toBe('equipment.create');
    expect(encolado_).toMatchObject({
      params: {},
      body: { ...input, id: expect.stringMatching(/^[0-9a-f-]{36}$/) },
      files: [{ field: 'photoKey', file: foto }],
    });
    expect(options.waitMs).toBe(OFFICE_WAIT_MS);
    expect(toast.success).toHaveBeenCalledWith('Equipo creado', { description: 'EX-001 ya está en la flota.' });
  });

  it('con la creación en cola, el aviso es el de "guardado en el equipo" y no el del servidor', async () => {
    submitWriteMock.mockResolvedValueOnce(encolado());
    const { result } = renderHook(() => useCreateEquipment(), { wrapper: wrapperNuevo() });

    result.current.mutate({ input });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(toast.success).toHaveBeenCalledWith(expect.stringContaining('Guardado'));
    expect(toast.success).not.toHaveBeenCalledWith('Equipo creado', expect.anything());
  });

  it('la asignación lleva el mismo id del equipo, su precondición y va detrás de la creación en cola', async () => {
    submitWriteMock.mockResolvedValueOnce(encolado('op-crear')).mockResolvedValueOnce(encolado('op-asignar'));
    const { result } = renderHook(() => useCreateEquipment(), { wrapper: wrapperNuevo() });

    result.current.mutate({ input, asignacion: { operatorId: 'op_1', supervisorId: null } });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(submitWriteMock).toHaveBeenCalledTimes(2);
    const [, crear] = submitWriteMock.mock.calls[0]!;
    const [endpoint, asignar] = submitWriteMock.mock.calls[1]!;
    expect(endpoint).toBe('equipment.assign');
    expect(asignar).toMatchObject({
      params: { id: crear.body.id },
      body: { operatorId: 'op_1', supervisorId: null },
      expected: { operatorId: null, supervisorId: null },
      dependsOn: ['op-crear'],
    });
  });

  it('con la creación ya enviada, la asignación no depende de nada', async () => {
    submitWriteMock.mockResolvedValueOnce(enviado(EQUIPO)).mockResolvedValueOnce(enviado(EQUIPO));
    const { result } = renderHook(() => useCreateEquipment(), { wrapper: wrapperNuevo() });

    result.current.mutate({ input, asignacion: { operatorId: 'op_1' } });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(submitWriteMock.mock.calls[1]![1].dependsOn).toBeUndefined();
  });

  it('si la asignación falla por negocio, el equipo igual quedó creado: avisa el error y no tumba la mutación', async () => {
    submitWriteMock
      .mockResolvedValueOnce(enviado(EQUIPO))
      .mockRejectedValueOnce(new DomainError('inactive', { code: 'OPERATOR_INACTIVE', status: 409 }));
    const { result } = renderHook(() => useCreateEquipment(), { wrapper: wrapperNuevo() });

    result.current.mutate({ input, asignacion: { operatorId: 'op_1' } });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(toast.danger).toHaveBeenCalledWith('Ese operador ya no está activo. Elegí otro del catálogo.');
  });

  it('un 409 sin code (código interno repetido) muestra el mensaje del servidor', async () => {
    submitWriteMock.mockRejectedValueOnce(new DomainError('Ya existe un equipo con el código EX-001', { status: 409 }));
    const { result } = renderHook(() => useCreateEquipment(), { wrapper: wrapperNuevo() });

    result.current.mutate({ input });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(toast.danger).toHaveBeenCalledWith('Ya existe un equipo con el código EX-001');
  });
});

describe('useUpdateEquipment', () => {
  it('manda SOLO los campos tocados y su valor base como precondición', async () => {
    submitWriteMock.mockResolvedValueOnce(enviado(EQUIPO));
    const { result } = renderHook(() => useUpdateEquipment(), { wrapper: wrapperNuevo() });

    result.current.mutate({
      equipo: EQUIPO,
      input: {
        licensePlate: null,
        equipmentClass: 'HEAVY',
        type: 'Retroexcavadora',
        brand: 'Caterpillar',
        model: '336',
        year: 2019,
        controlUnit: 'HOURS',
        status: 'OPERATIONAL',
        homeBranchId: null,
      },
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const { endpoint, input } = ultimaEscritura();
    expect(endpoint).toBe('equipment.update');
    expect(input).toMatchObject({
      params: { id: 'eq_1' },
      body: { type: 'Retroexcavadora' },
      expected: { type: 'Excavadora' },
    });
    expect(toast.success).toHaveBeenCalledWith('Equipo actualizado', { description: 'EX-001' });
  });

  it('sin ningún cambio no encola nada', async () => {
    const { result } = renderHook(() => useUpdateEquipment(), { wrapper: wrapperNuevo() });

    result.current.mutate({
      equipo: EQUIPO,
      input: {
        licensePlate: null,
        equipmentClass: 'HEAVY',
        type: 'Excavadora',
        brand: 'Caterpillar',
        model: '336',
        year: 2019,
        controlUnit: 'HOURS',
        status: 'OPERATIONAL',
        homeBranchId: null,
      },
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(submitWriteMock).not.toHaveBeenCalled();
  });

  it('una foto nueva viaja como archivo y quitarla manda photoKey: null, ninguna en la precondición', async () => {
    submitWriteMock.mockResolvedValue(enviado(EQUIPO));
    const { result } = renderHook(() => useUpdateEquipment(), { wrapper: wrapperNuevo() });
    const base = { ...EQUIPO };
    const input = {
      licensePlate: null,
      equipmentClass: 'HEAVY' as const,
      type: 'Excavadora',
      brand: 'Caterpillar',
      model: '336',
      year: 2019,
      controlUnit: 'HOURS' as const,
      status: 'OPERATIONAL' as const,
      homeBranchId: null,
    };
    const foto = new File(['x'], 'nueva.jpg', { type: 'image/jpeg' });

    result.current.mutate({ equipo: base, input, photo: foto });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(ultimaEscritura().input).toMatchObject({ files: [{ field: 'photoKey', file: foto }] });
    expect(ultimaEscritura().input.expected).toBeUndefined();

    result.current.mutate({ equipo: base, input, quitarFoto: true });
    await waitFor(() => expect(submitWriteMock).toHaveBeenCalledTimes(2));
    expect(ultimaEscritura().input).toMatchObject({ body: { photoKey: null } });
  });
});

describe('useUpdateEquipmentStatus', () => {
  it('encola equipment.status con el estado nuevo y el actual como precondición', async () => {
    submitWriteMock.mockResolvedValueOnce(enviado({ ...EQUIPO, status: 'IN_WORKSHOP' }));
    const { result } = renderHook(() => useUpdateEquipmentStatus(), { wrapper: wrapperNuevo() });

    result.current.mutate({ equipo: EQUIPO, status: 'IN_WORKSHOP' });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const { endpoint, input } = ultimaEscritura();
    expect(endpoint).toBe('equipment.status');
    expect(input).toMatchObject({
      params: { id: 'eq_1' },
      body: { status: 'IN_WORKSHOP' },
      expected: { status: 'OPERATIONAL' },
    });
    expect(toast.success).toHaveBeenCalledWith('Estado actualizado', { description: 'EX-001' });
  });

  it('en cola: el aviso común y no el toast que lee datos del servidor', async () => {
    submitWriteMock.mockResolvedValueOnce(encolado());
    const { result } = renderHook(() => useUpdateEquipmentStatus(), { wrapper: wrapperNuevo() });

    result.current.mutate({ equipo: EQUIPO, status: 'IN_WORKSHOP' });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(toast.success).toHaveBeenCalledWith(expect.stringContaining('Guardado'));
  });

  it('un STALE_UPDATE mientras se espera dice qué hacer en el formulario, no en la hoja de sincronización', async () => {
    submitWriteMock.mockRejectedValueOnce(new DomainError('stale', { code: 'STALE_UPDATE', status: 409 }));
    const { result } = renderHook(() => useUpdateEquipmentStatus(), { wrapper: wrapperNuevo() });

    result.current.mutate({ equipo: EQUIPO, status: 'IN_WORKSHOP' });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(toast.danger).toHaveBeenCalledWith(expect.stringContaining('Actualizá la pantalla'));
  });
});

describe('useAssignEquipment', () => {
  const equipo = { ...EQUIPO, operator: null, supervisor: { id: 'sup_1', name: 'Ana' } };

  it('encola equipment.assign con el body de asignación y la base de cada clave tocada', async () => {
    submitWriteMock.mockResolvedValueOnce(enviado({ ...EQUIPO, operator: { id: 'u_op', name: 'Pedro Soto' } }));
    const { result } = renderHook(() => useAssignEquipment(), { wrapper: wrapperNuevo() });

    result.current.mutate({ equipo, input: { operatorId: 'u_op', supervisorId: null } });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const { endpoint, input } = ultimaEscritura();
    expect(endpoint).toBe('equipment.assign');
    expect(input).toMatchObject({
      params: { id: 'eq_1' },
      body: { operatorId: 'u_op', supervisorId: null },
      expected: { operatorId: null, supervisorId: 'sup_1' },
    });
  });

  it('la precondición solo cubre las claves que se mandan', async () => {
    submitWriteMock.mockResolvedValueOnce(enviado(EQUIPO));
    const { result } = renderHook(() => useAssignEquipment(), { wrapper: wrapperNuevo() });

    result.current.mutate({ equipo, input: { operatorId: 'u_op' } });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(ultimaEscritura().input.expected).toEqual({ operatorId: null });
  });

  // El operador es un id del catálogo propio (`OperatorsService.assertActive`):
  // guardar puede fallar con 409 `OPERATOR_INACTIVE` (se desactivó entre que se
  // abrió el form y se guardó) o 404 (dejó de existir) — ambos casos deben mostrar
  // un toast claro, no el texto técnico del servidor.
  it('un 409 OPERATOR_INACTIVE muestra un toast claro en vez del mensaje crudo del backend', async () => {
    submitWriteMock.mockRejectedValueOnce(
      new DomainError('Operator op_1 is inactive', { code: 'OPERATOR_INACTIVE', status: 409 }),
    );
    const { result } = renderHook(() => useAssignEquipment(), { wrapper: wrapperNuevo() });

    result.current.mutate({ equipo, input: { operatorId: 'op_1' } });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(toast.danger).toHaveBeenCalledWith('Ese operador ya no está activo. Elegí otro del catálogo.');
  });

  it('un 404 (operador que ya no existe) muestra un toast claro, sin depender del texto del backend', async () => {
    submitWriteMock.mockRejectedValueOnce(new DomainError('Not Found', { status: 404 }));
    const { result } = renderHook(() => useAssignEquipment(), { wrapper: wrapperNuevo() });

    result.current.mutate({ equipo, input: { operatorId: 'op_borrado' } });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(toast.danger).toHaveBeenCalledWith(
      'El operador o supervisor elegido ya no existe. Actualizá la página e intentá de nuevo.',
    );
  });

  it('otros errores muestran el mensaje del backend tal cual (p. ej. EQUIPMENT_BUSY, que ya es claro)', async () => {
    submitWriteMock.mockRejectedValueOnce(
      new DomainError('El equipo ya tiene un turno abierto.', { code: 'EQUIPMENT_BUSY' }),
    );
    const { result } = renderHook(() => useAssignEquipment(), { wrapper: wrapperNuevo() });

    result.current.mutate({ equipo, input: { operatorId: 'op_1' } });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(toast.danger).toHaveBeenCalledWith('El equipo ya tiene un turno abierto.');
  });
});

describe('useDeleteEquipment', () => {
  it('encola equipment.delete con el id y avisa al confirmar', async () => {
    submitWriteMock.mockResolvedValueOnce(enviado(true));
    const { result } = renderHook(() => useDeleteEquipment(), { wrapper: wrapperNuevo() });

    result.current.mutate('eq_1');

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(ultimaEscritura()).toMatchObject({ endpoint: 'equipment.delete', input: { params: { id: 'eq_1' } } });
    expect(toast.success).toHaveBeenCalledWith('Equipo eliminado');
  });

  it('el 409 del servidor (tiene historial) llega tal cual', async () => {
    submitWriteMock.mockRejectedValueOnce(new DomainError('No se puede eliminar: tiene 3 registro(s) asociados', { status: 409 }));
    const { result } = renderHook(() => useDeleteEquipment(), { wrapper: wrapperNuevo() });

    result.current.mutate('eq_1');

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(toast.danger).toHaveBeenCalledWith('No se puede eliminar: tiene 3 registro(s) asociados');
  });
});

describe('useSaveEquipment', () => {
  const cambioDeTipo = {
    licensePlate: null,
    equipmentClass: 'HEAVY' as const,
    type: 'Retroexcavadora',
    brand: 'Caterpillar',
    model: '336',
    year: 2019,
    controlUnit: 'HOURS' as const,
    status: 'OPERATIONAL' as const,
    homeBranchId: null,
  };

  it('guarda la ficha y la asignación, cada una con su aviso', async () => {
    submitWriteMock.mockResolvedValueOnce(enviado({ internalCode: 'EX-001' }));
    submitWriteMock.mockResolvedValueOnce(enviado({ internalCode: 'EX-001' }));
    const { result } = renderHook(() => useSaveEquipment(), { wrapper: wrapperNuevo() });

    result.current.mutate({ equipo: EQUIPO, input: cambioDeTipo, asignacion: { operatorId: 'op_1' } });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(submitWriteMock.mock.calls.map(([endpoint]) => endpoint)).toEqual(['equipment.update', 'equipment.assign']);
    expect(toast.success).toHaveBeenCalledWith('Equipo actualizado', { description: 'EX-001' });
    expect(toast.success).toHaveBeenCalledWith('Asignación actualizada', { description: 'EX-001' });
    expect(result.current.data?.errorAsignacion).toBeNull();
  });

  it('sin asignación que cambiar solo guarda la ficha', async () => {
    submitWriteMock.mockResolvedValueOnce(enviado({ internalCode: 'EX-001' }));
    const { result } = renderHook(() => useSaveEquipment(), { wrapper: wrapperNuevo() });

    result.current.mutate({ equipo: EQUIPO, input: cambioDeTipo, asignacion: {} });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(submitWriteMock).toHaveBeenCalledTimes(1);
  });

  it('si la asignación falla, la ficha queda guardada y el error se avisa sin dar por buena la operación', async () => {
    submitWriteMock.mockResolvedValueOnce(enviado({ internalCode: 'EX-001' }));
    submitWriteMock.mockRejectedValueOnce(new DomainError('Ese operador ya no está activo.', { code: 'OPERATOR_INACTIVE', status: 409 }));
    const { result } = renderHook(() => useSaveEquipment(), { wrapper: wrapperNuevo() });

    result.current.mutate({ equipo: EQUIPO, input: cambioDeTipo, asignacion: { operatorId: 'op_1' } });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(toast.success).toHaveBeenCalledWith('Equipo actualizado', { description: 'EX-001' });
    expect(toast.danger).toHaveBeenCalledWith('Ese operador ya no está activo. Elegí otro del catálogo.');
    expect(result.current.data?.errorAsignacion).toBeInstanceOf(DomainError);
  });

  it('si la ficha falla, la asignación ni se intenta', async () => {
    submitWriteMock.mockRejectedValueOnce(new DomainError('Código duplicado', { status: 409 }));
    const { result } = renderHook(() => useSaveEquipment(), { wrapper: wrapperNuevo() });

    result.current.mutate({ equipo: EQUIPO, input: cambioDeTipo, asignacion: { operatorId: 'op_1' } });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(submitWriteMock).toHaveBeenCalledTimes(1);
    expect(toast.danger).toHaveBeenCalledWith('Código duplicado');
  });

  it('con lo que quedó en cola avisa una sola vez que quedó guardado', async () => {
    submitWriteMock.mockResolvedValue(encolado());
    const { result } = renderHook(() => useSaveEquipment(), { wrapper: wrapperNuevo() });

    result.current.mutate({ equipo: EQUIPO, input: cambioDeTipo, asignacion: { operatorId: 'op_1' } });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(toast.success).toHaveBeenCalledTimes(1);
    expect(toast.success).toHaveBeenCalledWith(expect.stringContaining('Guardado'));
  });
});
