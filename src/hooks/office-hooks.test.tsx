import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

/**
 * Hooks de oficina (Flota: horómetro/combustible; Inventario; Catálogos;
 * Mantenimiento) sobre la cola de escrituras: lo que se verifica es lo que cada
 * hook ENCOLA (endpoint, params, body, `expected`, archivos, dependencias) y cómo
 * reacciona a `sent` / `queued` / un error de negocio. El borde (`submitWrite`) y
 * la lectura de lo pendiente (`offline/outbox`) se reemplazan por dobles; la cola
 * real se prueba en `offline/*.test.ts`.
 */
const { cambiosMock, escriturasMock } = vi.hoisted(() => ({
  cambiosMock: vi.fn(),
  escriturasMock: vi.fn(),
}));

vi.mock('../offline/submit-write', async (importOriginal) =>
  (await import('../test/office-write')).conSubmitWriteFalso(await importOriginal()),
);
vi.mock('../offline/outbox', () => ({ cambiosPendientes: cambiosMock, escriturasPendientes: escriturasMock }));
vi.mock('@heroui/react', () => ({
  toast: { success: vi.fn(), danger: vi.fn(), warning: vi.fn(), info: vi.fn() },
}));

import { toast } from '@heroui/react';
import { DomainError } from '../lib/api-error';
import { encolado, enviado, submitWriteMock, ultimaEscritura } from '../test/office-write';
import type { Actividad, OrdenTrabajo } from '../types/mantenimiento';
import type { Branch } from '../types/branch';
import type { ItemCategory } from '../types/category';
import type { InventoryItem } from '../types/inventory';
import type { Operator } from '../types/operator';
import { useActualizarActividad, useCrearActividad } from './useActividades';
import { useCreateCategory, useDeleteCategory, useUpdateCategory } from './useCategories';
import { useCreateCombustible } from './useCombustible';
import { useCerrarHorometro, useCreateHorometro } from './useHorometro';
import { useCrearIntervencion } from './useIntervenciones';
import {
  useAdjustStock,
  useCreateItem,
  useCreateMovement,
  useDeleteItem,
  useSaveItemWithMinimums,
  useTransferStock,
  useUpdateItem,
} from './useInventory';
import {
  useCreateOperator,
  useDeleteOperator,
  useToggleOperatorActive,
  useUpdateOperator,
} from './useOperators';
import { useActualizarOrden, useCrearOrden, useToggleTarea } from './useOrdenes';
import { useCrearUmbral } from './useUmbrales';

const UUID = expect.stringMatching(/^[0-9a-f-]{36}$/);

function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={new QueryClient()}>{children}</QueryClientProvider>;
}

beforeEach(() => {
  cambiosMock.mockResolvedValue({});
  escriturasMock.mockResolvedValue([]);
});

afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});

/** Corre la mutación y espera a que termine (bien o mal). */
async function correr<TVars>(
  hook: () => { mutate: (vars: TVars) => void; isSuccess: boolean; isError: boolean },
  vars: TVars,
  resultado: 'ok' | 'error' = 'ok',
) {
  const { result } = renderHook(hook, { wrapper });
  result.current.mutate(vars);
  await waitFor(() => expect(resultado === 'ok' ? result.current.isSuccess : result.current.isError).toBe(true));
}

describe('Flota — horómetro', () => {
  const entrada = {
    equipoId: 'eq_1',
    operatorId: 'op_1',
    turno: 'DIURNO' as const,
    valorInicial: 1200,
    valorFinal: undefined,
    nivelCombustible: 80,
  };

  it('la entrada lleva el id del cliente y la hora del dispositivo', async () => {
    submitWriteMock.mockResolvedValueOnce(enviado(true));

    await correr(useCreateHorometro, entrada);

    const { endpoint, input, options } = ultimaEscritura();
    expect(endpoint).toBe('horometro.create');
    expect(options.waitMs).toBeGreaterThan(0);
    expect(input).toMatchObject({
      params: {},
      body: { ...entrada, id: UUID, capturedAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/) },
    });
  });

  it('un turno ya abierto (EQUIPMENT_BUSY) muestra el mensaje del servidor tal cual', async () => {
    submitWriteMock.mockRejectedValueOnce(
      new DomainError('El equipo ya tiene un turno en curso desde las 08:00.', { code: 'EQUIPMENT_BUSY', status: 400 }),
    );

    await correr(useCreateHorometro, entrada, 'error');

    expect(toast.danger).toHaveBeenCalledWith('El equipo ya tiene un turno en curso desde las 08:00.');
  });

  it('en cola avisa que quedó guardado en el equipo', async () => {
    submitWriteMock.mockResolvedValueOnce(encolado());

    await correr(useCreateHorometro, entrada);

    expect(toast.success).toHaveBeenCalledWith(expect.stringContaining('Guardado'));
  });

  it('la salida genera UN closeClientId al encolar y lo deja en el body', async () => {
    submitWriteMock.mockResolvedValueOnce(encolado());

    await correr(useCerrarHorometro, { id: 'h_1', payload: { valorFinal: 1210, nivelCombustible: 60 } });

    const { endpoint, input } = ultimaEscritura();
    expect(endpoint).toBe('horometro.close');
    expect(input).toMatchObject({
      params: { id: 'h_1' },
      body: { valorFinal: 1210, nivelCombustible: 60, closeClientId: UUID, capturedAt: expect.any(String) },
    });
  });

  it.each([
    ['CARD_NOT_FOUND', 404, 'El turno que intentás cerrar ya no existe'],
    ['ALREADY_CLOSED', 409, 'Este turno ya fue cerrado por otra persona'],
    ['FORBIDDEN', 403, 'Tu rol no puede hacer esta acción'],
    ['SHIFT_CARD_CLOSE_ELSEWHERE', 409, 'la cierra el supervisor desde Terreno'],
    ['INVALID_CAPTURE_TIME', 400, 'La hora del registro no es válida'],
  ])('el error %s de la salida tiene un texto claro', async (code, status, texto) => {
    submitWriteMock.mockRejectedValueOnce(new DomainError('x', { code, status }));

    await correr(useCerrarHorometro, { id: 'h_1', payload: { valorFinal: 5 } }, 'error');

    expect(toast.danger).toHaveBeenCalledWith(expect.stringContaining(texto));
  });
});

describe('Flota — combustible', () => {
  it('encola la carga con la foto como archivo "fotoKey" y el id del cliente', async () => {
    submitWriteMock.mockResolvedValueOnce(encolado());
    const foto = new File(['x'], 'surtidor.jpg', { type: 'image/jpeg' });

    await correr(useCreateCombustible, {
      input: { equipoId: 'eq_1', litros: 80, tipo: 'PETROLEO', fecha: '2026-10-05T10:00:00.000Z' },
      foto,
    });

    const { endpoint, input } = ultimaEscritura();
    expect(endpoint).toBe('combustible.create');
    expect(input).toMatchObject({
      body: { equipoId: 'eq_1', litros: 80, tipo: 'PETROLEO', fecha: '2026-10-05T10:00:00.000Z', id: UUID },
      files: [{ field: 'fotoKey', file: foto }],
    });
  });

  it('un archivo rechazado al guardar (FILE_TOO_LARGE) sale en el formulario', async () => {
    submitWriteMock.mockRejectedValueOnce(new DomainError('x', { code: 'FILE_TOO_LARGE' }));

    await correr(
      useCreateCombustible,
      { input: { equipoId: 'eq_1', litros: 80, tipo: 'PETROLEO' }, foto: new File(['x'], 'a.jpg') },
      'error',
    );

    expect(toast.danger).toHaveBeenCalledWith('El archivo supera el máximo de 8 MB.');
  });
});

describe('Flota — confirmación cuando el servidor responde a tiempo', () => {
  it('la entrada, la salida y la carga de combustible confirman con su aviso (antes no decían nada)', async () => {
    submitWriteMock.mockResolvedValue(enviado(true));

    await correr(useCreateHorometro, {
      equipoId: 'eq_1',
      operatorId: 'op_1',
      turno: 'DIURNO' as const,
      valorInicial: 1200,
      valorFinal: undefined,
    });
    expect(toast.success).toHaveBeenLastCalledWith('Entrada registrada');

    await correr(useCerrarHorometro, { id: 'h_1', payload: { valorFinal: 1210 } });
    expect(toast.success).toHaveBeenLastCalledWith('Salida registrada');

    await correr(useCreateCombustible, {
      input: { equipoId: 'eq_1', litros: 80, tipo: 'PETROLEO' },
      foto: new File(['x'], 'surtidor.jpg'),
    });
    expect(toast.success).toHaveBeenLastCalledWith('Carga de combustible registrada');
  });
});

describe('Inventario', () => {
  const ITEM = {
    id: 'it_1',
    sku: 'FIL-001',
    name: 'Filtro de aceite',
    description: 'Original',
    unit: 'UNIT',
    type: 'PART',
    categoryId: 'cat_1',
    category: { id: 'cat_1', name: 'Filtros' },
    partNumber: 'P-1',
    defaultSupplier: null,
    isCritical: false,
    isActive: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    stocks: [{ branchId: 'br_1', quantity: 10, minimumQuantity: 4, branch: { id: 'br_1', name: 'Centro' } }],
  } as unknown as InventoryItem;

  it('crear un ítem lleva el id del cliente; enviado muestra sku y nombre del servidor', async () => {
    submitWriteMock.mockResolvedValueOnce(enviado(ITEM));

    await correr(useCreateItem, { sku: 'FIL-001', name: 'Filtro de aceite', unit: 'UNIT', type: 'PART' });

    expect(ultimaEscritura()).toMatchObject({
      endpoint: 'item.create',
      input: { body: { sku: 'FIL-001', id: UUID } },
    });
    expect(toast.success).toHaveBeenCalledWith('Ítem creado', { description: 'FIL-001 · Filtro de aceite' });
  });

  it('un SKU repetido (409 sin code) muestra el mensaje del servidor', async () => {
    submitWriteMock.mockRejectedValueOnce(new DomainError('Ya existe el SKU FIL-001', { status: 409 }));

    await correr(useCreateItem, { sku: 'FIL-001', name: 'X', unit: 'UNIT', type: 'PART' }, 'error');

    expect(toast.danger).toHaveBeenCalledWith('Ya existe el SKU FIL-001');
  });

  describe('editar', () => {
    const edicion = {
      name: 'Filtro de aceite XL',
      unit: 'UNIT' as const,
      type: 'PART' as const,
      categoryId: 'cat_1',
      isCritical: false,
      isActive: true,
    };

    it('manda solo lo tocado y su valor base; un texto vacío omitido no se toma por "borrar"', async () => {
      submitWriteMock.mockResolvedValueOnce(enviado(ITEM));

      await correr(useUpdateItem, { item: ITEM, input: edicion });

      expect(ultimaEscritura()).toMatchObject({
        endpoint: 'item.update',
        input: {
          params: { id: 'it_1' },
          body: { name: 'Filtro de aceite XL' },
          expected: { name: 'Filtro de aceite' },
        },
      });
    });

    it('parte de lo que ya espera en la cola, no de lo que ve la pantalla', async () => {
      cambiosMock.mockResolvedValue({ name: 'Nombre pendiente' });
      submitWriteMock.mockResolvedValueOnce(encolado());

      await correr(useUpdateItem, { item: ITEM, input: edicion });

      expect(ultimaEscritura().input.expected).toEqual({ name: 'Nombre pendiente' });
    });

    it('sin cambios no encola nada', async () => {
      await correr(useUpdateItem, { item: ITEM, input: { ...edicion, name: 'Filtro de aceite' } });

      expect(submitWriteMock).not.toHaveBeenCalled();
    });
  });

  it('eliminar un ítem encola el borrado', async () => {
    submitWriteMock.mockResolvedValueOnce(enviado(true));

    await correr(useDeleteItem, 'it_1');

    expect(ultimaEscritura()).toMatchObject({ endpoint: 'item.delete', input: { params: { id: 'it_1' } } });
    expect(toast.success).toHaveBeenCalledWith('Ítem eliminado');
  });

  describe('movimientos', () => {
    const salida = { itemId: 'it_1', branchId: 'br_1', direction: 'OUT' as const, reason: 'ACTIVITY' as const, quantity: 8 };
    const movimiento = (resultingBalance: number) => ({ branchId: 'br_1', resultingBalance });

    it('el id del movimiento lo genera el cliente', async () => {
      submitWriteMock.mockResolvedValueOnce(enviado(movimiento(2)));

      await correr(useCreateMovement, { input: salida, item: ITEM });

      expect(ultimaEscritura()).toMatchObject({ endpoint: 'movement.create', input: { body: { ...salida, id: UUID } } });
    });

    it('enviado y bajo el mínimo: el aviso lo dice en el momento', async () => {
      submitWriteMock.mockResolvedValueOnce(enviado(movimiento(2)));

      await correr(useCreateMovement, { input: salida, item: ITEM });

      expect(toast.warning).toHaveBeenCalledWith('Movimiento registrado · quedaste bajo el mínimo', {
        description: 'Quedan 2 u y el mínimo de esta bodega es 4.',
      });
    });

    it('enviado con saldo sano: el saldo resultante', async () => {
      submitWriteMock.mockResolvedValueOnce(enviado(movimiento(9)));

      await correr(useCreateMovement, { input: { ...salida, quantity: 1 }, item: ITEM });

      expect(toast.success).toHaveBeenCalledWith('Movimiento registrado', {
        description: 'Saldo en esta bodega: 9 u',
      });
    });

    it('en cola no hay saldo que mostrar: texto genérico', async () => {
      submitWriteMock.mockResolvedValueOnce(encolado());

      await correr(useCreateMovement, { input: salida, item: ITEM });

      expect(toast.success).toHaveBeenCalledWith(expect.stringContaining('Guardado'));
      expect(toast.warning).not.toHaveBeenCalled();
    });

    it('una salida sin existencia (INSUFFICIENT_STOCK) muestra lo disponible y lo pedido que dice el servidor', async () => {
      const mensaje = 'Existencia insuficiente de "Aceite" en Casa Matriz: disponible 16, solicitado 20. Hay 5 en otras sucursales.';
      submitWriteMock.mockRejectedValueOnce(new DomainError(mensaje, { code: 'INSUFFICIENT_STOCK', status: 409 }));

      await correr(useCreateMovement, { input: salida, item: ITEM }, 'error');

      expect(toast.danger).toHaveBeenCalledWith(mensaje);
    });
  });

  describe('traspaso', () => {
    const traspaso = { itemId: 'it_1', sourceBranchId: 'br_1', destinationBranchId: 'br_2', quantity: 3 };

    it('el id es el del movimiento de salida; enviado usa los nombres de bodega del servidor', async () => {
      submitWriteMock.mockResolvedValueOnce(
        enviado({ sourceBranchName: 'Centro', destinationBranchName: 'Faena' }),
      );

      await correr(useTransferStock, traspaso);

      expect(ultimaEscritura()).toMatchObject({ endpoint: 'stock.transfer', input: { body: { ...traspaso, id: UUID } } });
      expect(toast.success).toHaveBeenCalledWith('Traspaso registrado: de Centro a Faena');
    });

    it('en cola, texto genérico', async () => {
      submitWriteMock.mockResolvedValueOnce(encolado());

      await correr(useTransferStock, traspaso);

      expect(toast.success).toHaveBeenCalledWith(expect.stringContaining('Guardado'));
    });
  });

  describe('conteo físico', () => {
    const conteo = { branchId: 'br_1', countedQuantity: 7, expectedQuantity: 10 };

    it('manda id del asiento y expectedQuantity = la existencia que se veía', async () => {
      submitWriteMock.mockResolvedValueOnce(enviado({ item: ITEM, movement: { resultingBalance: 7 } }));

      await correr(useAdjustStock, { id: 'it_1', input: conteo });

      expect(ultimaEscritura()).toMatchObject({
        endpoint: 'item.adjust',
        input: { params: { id: 'it_1' }, body: { ...conteo, id: UUID } },
      });
      expect(toast.success).toHaveBeenCalledWith('Existencia ajustada', {
        description: 'Filtro de aceite: saldo ahora en 7',
      });
    });

    it('un conteo que coincide (movement null) lo avisa sin movimiento', async () => {
      submitWriteMock.mockResolvedValueOnce(enviado({ item: ITEM, movement: null }));

      await correr(useAdjustStock, { id: 'it_1', input: conteo });

      expect(toast.info).toHaveBeenCalledWith(expect.stringContaining('no se movió nada'));
    });

    it('lo que ya espera en la cola (salida de 2, entrada de 5 en otra bodega) mueve la existencia esperada', async () => {
      escriturasMock.mockResolvedValue([
        { endpoint: 'movement.create', body: { branchId: 'br_1', direction: 'OUT', quantity: 2 } },
        { endpoint: 'movement.create', body: { branchId: 'br_9', direction: 'IN', quantity: 5 } },
        { endpoint: 'stock.transfer', body: { sourceBranchId: 'br_1', destinationBranchId: 'br_2', quantity: 1 } },
      ]);
      submitWriteMock.mockResolvedValueOnce(encolado());

      await correr(useAdjustStock, { id: 'it_1', input: conteo });

      expect(ultimaEscritura().input.body).toMatchObject({ expectedQuantity: 7 });
    });

    it('alguien movió stock mientras se contaba (STALE_UPDATE): el aviso dice qué hacer en el formulario', async () => {
      submitWriteMock.mockRejectedValueOnce(new DomainError('stale', { code: 'STALE_UPDATE', status: 409 }));

      await correr(useAdjustStock, { id: 'it_1', input: conteo }, 'error');

      expect(toast.danger).toHaveBeenCalledWith(expect.stringContaining('mientras contabas'));
    });
  });

  describe('guardar la ficha con los mínimos', () => {
    const ITEM_CON_STOCK = {
      ...ITEM,
      stocks: [
        { branchId: 'br_1', branchName: 'Centro', quantity: 10, minimumQuantity: 4 },
        { branchId: 'br_2', branchName: 'Faena', quantity: 3, minimumQuantity: 0 },
      ],
    } as unknown as InventoryItem;
    const sinCambios = { name: ITEM.name, unit: ITEM.unit, type: ITEM.type };
    const cambioDeNombre = { ...sinCambios, name: 'Aceite 15W40' };

    it('edita la ficha y manda solo los mínimos que cambiaron, con UN solo aviso', async () => {
      submitWriteMock.mockResolvedValueOnce(enviado({ name: 'Aceite 15W40' }));
      submitWriteMock.mockResolvedValueOnce(enviado(true));

      await correr(useSaveItemWithMinimums, {
        item: ITEM_CON_STOCK,
        input: cambioDeNombre,
        minimums: { br_1: '4', br_2: '6,5' },
      });

      const escrituras = submitWriteMock.mock.calls.map(([endpoint, input]) => ({ endpoint, input }));
      expect(escrituras).toMatchObject([
        { endpoint: 'item.update', input: { params: { id: ITEM_CON_STOCK.id }, body: { name: 'Aceite 15W40' } } },
        {
          endpoint: 'item.setMinimum',
          input: { body: { itemId: ITEM_CON_STOCK.id, branchId: 'br_2', minimumQuantity: 6.5 } },
        },
      ]);
      expect(escrituras[1]?.input).not.toHaveProperty('dependsOn');
      expect(toast.success).toHaveBeenCalledTimes(1);
      expect(toast.success).toHaveBeenCalledWith('Ítem actualizado', { description: ITEM_CON_STOCK.name });
    });

    it('sin cambios en la ficha, solo se manda el mínimo', async () => {
      submitWriteMock.mockResolvedValueOnce(enviado(true));

      await correr(useSaveItemWithMinimums, {
        item: ITEM_CON_STOCK,
        input: sinCambios,
        minimums: { br_1: '8', br_2: '0' },
      });

      expect(submitWriteMock).toHaveBeenCalledTimes(1);
      expect(ultimaEscritura()).toMatchObject({
        endpoint: 'item.setMinimum',
        input: { body: { itemId: ITEM_CON_STOCK.id, branchId: 'br_1', minimumQuantity: 8 } },
      });
    });

    it('si algo queda en cola avisa una sola vez que quedó guardado', async () => {
      submitWriteMock.mockResolvedValueOnce(encolado());
      submitWriteMock.mockResolvedValueOnce(encolado());

      await correr(useSaveItemWithMinimums, {
        item: ITEM_CON_STOCK,
        input: cambioDeNombre,
        minimums: { br_1: '9', br_2: '0' },
      });

      expect(toast.success).toHaveBeenCalledTimes(1);
      expect(toast.success).toHaveBeenCalledWith(expect.stringContaining('Guardado'));
    });

    it('si falla la edición, los mínimos ni se intentan y el error se avisa', async () => {
      submitWriteMock.mockRejectedValueOnce(new DomainError('Nombre duplicado', { status: 409 }));

      await correr(
        useSaveItemWithMinimums,
        { item: ITEM_CON_STOCK, input: cambioDeNombre, minimums: { br_1: '9', br_2: '0' } },
        'error',
      );

      expect(submitWriteMock).toHaveBeenCalledTimes(1);
      expect(toast.danger).toHaveBeenCalledWith('Nombre duplicado');
    });

    it('si falla un mínimo, la ficha ya quedó guardada: el aviso lo dice con el motivo', async () => {
      submitWriteMock.mockResolvedValueOnce(enviado({ name: 'Aceite 15W40' }));
      submitWriteMock.mockRejectedValueOnce(new DomainError('La bodega no existe', { status: 404 }));

      await correr(useSaveItemWithMinimums, {
        item: ITEM_CON_STOCK,
        input: cambioDeNombre,
        minimums: { br_1: '9', br_2: '0' },
      });

      expect(toast.warning).toHaveBeenCalledWith('Ítem actualizado, pero no se guardó el stock mínimo', {
        description: 'La bodega no existe',
      });
      expect(toast.success).not.toHaveBeenCalled();
    });

    it('sin nada que cambiar no escribe ni avisa', async () => {
      await correr(useSaveItemWithMinimums, { item: ITEM_CON_STOCK, input: sinCambios, minimums: { br_1: '4', br_2: '0' } });

      expect(submitWriteMock).not.toHaveBeenCalled();
      expect(toast.success).not.toHaveBeenCalled();
    });
  });
});

describe('Categorías', () => {
  const CATEGORIA = { id: 'cat_1', name: 'Filtros' } as unknown as ItemCategory;

  it('crear lleva el id del cliente', async () => {
    submitWriteMock.mockResolvedValueOnce(enviado(CATEGORIA));

    await correr(useCreateCategory, 'Filtros');

    expect(ultimaEscritura()).toMatchObject({ endpoint: 'category.create', input: { body: { name: 'Filtros', id: UUID } } });
    expect(toast.success).toHaveBeenCalledWith('Categoría creada', { description: 'Filtros' });
  });

  it('renombrar manda el nombre nuevo con el anterior como precondición', async () => {
    submitWriteMock.mockResolvedValueOnce(enviado(CATEGORIA));

    await correr(useUpdateCategory, { category: CATEGORIA, name: 'Filtros y bujías' });

    expect(ultimaEscritura()).toMatchObject({
      endpoint: 'category.update',
      input: { params: { id: 'cat_1' }, body: { name: 'Filtros y bujías' }, expected: { name: 'Filtros' } },
    });
  });

  it('borrar encola el borrado', async () => {
    submitWriteMock.mockResolvedValueOnce(enviado(true));

    await correr(useDeleteCategory, 'cat_1');

    expect(ultimaEscritura()).toMatchObject({ endpoint: 'category.delete', input: { params: { id: 'cat_1' } } });
  });
});

describe('Operadores', () => {
  const OPERADOR = { id: 'op_1', name: 'Juan Rojas', rut: '12345678-5', isActive: true } as unknown as Operator;

  it('crear lleva el id del cliente', async () => {
    submitWriteMock.mockResolvedValueOnce(enviado(OPERADOR));

    await correr(useCreateOperator, { name: 'Juan Rojas', rut: '12345678-5' });

    expect(ultimaEscritura()).toMatchObject({
      endpoint: 'operator.create',
      input: { body: { name: 'Juan Rojas', rut: '12345678-5', id: UUID } },
    });
  });

  it('un RUT repetido (409 sin code) muestra el mensaje del servidor', async () => {
    submitWriteMock.mockRejectedValueOnce(new DomainError('Ya existe un operador con ese RUT', { status: 409 }));

    await correr(useCreateOperator, { name: 'Juan Rojas', rut: '12345678-5' }, 'error');

    expect(toast.danger).toHaveBeenCalledWith('Ya existe un operador con ese RUT');
  });

  it('editar manda solo lo tocado; un RUT omitido es "sin cambio"', async () => {
    submitWriteMock.mockResolvedValueOnce(enviado(OPERADOR));

    await correr(useUpdateOperator, { operator: OPERADOR, input: { name: 'Juan Rojas Soto', isActive: true } });

    expect(ultimaEscritura()).toMatchObject({
      endpoint: 'operator.update',
      input: { params: { id: 'op_1' }, body: { name: 'Juan Rojas Soto' }, expected: { name: 'Juan Rojas' } },
    });
  });

  it('activar/desactivar es la misma escritura, con isActive como único campo', async () => {
    submitWriteMock.mockResolvedValueOnce(enviado({ ...OPERADOR, isActive: false }));

    await correr(useToggleOperatorActive, { operator: OPERADOR, isActive: false });

    expect(ultimaEscritura()).toMatchObject({
      endpoint: 'operator.update',
      input: { body: { isActive: false }, expected: { isActive: true } },
    });
    expect(toast.success).toHaveBeenCalledWith('Operador desactivado', { description: 'Juan Rojas' });
  });

  it('borrar encola el borrado y el 409 (en uso) llega tal cual', async () => {
    submitWriteMock.mockRejectedValueOnce(new DomainError('El operador está en uso: desactivalo', { status: 409 }));

    await correr(useDeleteOperator, 'op_1', 'error');

    expect(ultimaEscritura()).toMatchObject({ endpoint: 'operator.delete', input: { params: { id: 'op_1' } } });
    expect(toast.danger).toHaveBeenCalledWith('El operador está en uso: desactivalo');
  });
});

describe('Mantenimiento', () => {
  const ORDEN = {
    id: 'ot_1',
    equipoId: 'eq_1',
    titulo: 'Cambio de aceite',
    estado: 'PENDIENTE',
    prioridad: 'MEDIA',
    tipo: 'PREVENTIVA',
    origen: 'MANUAL',
    origenDetalle: null,
    asignadoA: null,
    tareas: [],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  } as unknown as OrdenTrabajo;

  it('crear una orden lleva el id del cliente', async () => {
    submitWriteMock.mockResolvedValueOnce(enviado(ORDEN));

    await correr(useCrearOrden, {
      equipoId: 'eq_1',
      titulo: 'Cambio de aceite',
      prioridad: 'MEDIA',
      tipo: 'PREVENTIVA',
      origen: 'MANUAL',
    });

    expect(ultimaEscritura()).toMatchObject({ endpoint: 'orden.create', input: { body: { equipoId: 'eq_1', id: UUID } } });
    expect(toast.success).toHaveBeenCalledWith('Orden de trabajo creada', { description: 'Cambio de aceite' });
  });

  it('cambiar el estado manda solo el estado con el anterior como precondición', async () => {
    submitWriteMock.mockResolvedValueOnce(enviado(ORDEN));

    await correr(useActualizarOrden, { orden: ORDEN, input: { estado: 'EN_PROCESO' } });

    expect(ultimaEscritura()).toMatchObject({
      endpoint: 'orden.update',
      input: { params: { id: 'ot_1' }, body: { estado: 'EN_PROCESO' }, expected: { estado: 'PENDIENTE' } },
    });
  });

  it('desasignar una orden manda asignadoAId null y espera el asignado de hoy', async () => {
    submitWriteMock.mockResolvedValueOnce(enviado(ORDEN));
    const asignada = { ...ORDEN, asignadoA: { id: 'u_7', name: 'Pedro' } } as unknown as OrdenTrabajo;

    await correr(useActualizarOrden, { orden: asignada, input: { asignadoAId: null } });

    expect(ultimaEscritura()).toMatchObject({
      endpoint: 'orden.update',
      input: { params: { id: 'ot_1' }, body: { asignadoAId: null }, expected: { asignadoAId: 'u_7' } },
    });
  });

  it('un campo que el formulario no manda no se toca: sin cambios no escribe', async () => {
    await correr(useActualizarOrden, { orden: ORDEN, input: { estado: 'PENDIENTE' } });

    expect(submitWriteMock).not.toHaveBeenCalled();
  });

  it('marcar una tarea es un set: sin precondición', async () => {
    submitWriteMock.mockResolvedValueOnce(encolado());

    await correr(useToggleTarea, { ordenId: 'ot_1', tareaId: 'ta_1', hecha: true });

    const { endpoint, input } = ultimaEscritura();
    expect(endpoint).toBe('orden.toggleTarea');
    expect(input).toMatchObject({ params: { ordenId: 'ot_1', tareaId: 'ta_1' }, body: { hecha: true } });
    expect(input.expected).toBeUndefined();
  });

  it('una intervención va a la orden y lleva el id del cliente', async () => {
    submitWriteMock.mockResolvedValueOnce(enviado(null));

    await correr(useCrearIntervencion, {
      ordenId: 'ot_1',
      input: { tipo: 'PREVENTIVA', detalle: 'Cambio de filtros', horasHombre: 2 },
    });

    expect(ultimaEscritura()).toMatchObject({
      endpoint: 'intervencion.create',
      input: { params: { ordenId: 'ot_1' }, body: { detalle: 'Cambio de filtros', id: UUID } },
    });
    expect(toast.success).toHaveBeenCalledWith('Intervención registrada');
  });

  it('crear un umbral lleva el id del cliente', async () => {
    submitWriteMock.mockResolvedValueOnce(encolado());

    await correr(useCrearUmbral, { tipoEquipo: 'Excavadora', tipoMantencion: 'Aceite', umbralHoras: 250 });

    expect(ultimaEscritura()).toMatchObject({ endpoint: 'umbral.create', input: { body: { umbralHoras: 250, id: UUID } } });
  });

  it('crear una actividad lleva el id del cliente', async () => {
    submitWriteMock.mockResolvedValueOnce(enviado(null));

    await correr(useCrearActividad, { descripcion: 'Revisar frenos', origen: 'MANUAL' });

    expect(ultimaEscritura()).toMatchObject({ endpoint: 'actividad.create', input: { body: { descripcion: 'Revisar frenos', id: UUID } } });
  });

  it('completar una actividad manda el estado con el anterior como precondición', async () => {
    const actividad = { id: 'ac_1', estado: 'PENDIENTE' } as unknown as Actividad;
    submitWriteMock.mockResolvedValueOnce(enviado(null));

    await correr(useActualizarActividad, { actividad, input: { estado: 'COMPLETADA' } });

    expect(ultimaEscritura()).toMatchObject({
      endpoint: 'actividad.update',
      input: { params: { id: 'ac_1' }, body: { estado: 'COMPLETADA' }, expected: { estado: 'PENDIENTE' } },
    });
  });
});

describe('Sucursales (catálogo)', () => {
  it('una edición parte de lo que ya espera en la cola', async () => {
    const { useUpdateBranch } = await import('./useBranches');
    const sucursal = { id: 'br_1', name: 'Centro', address: null, isActive: true } as unknown as Branch;
    cambiosMock.mockResolvedValue({ name: 'Centro (pendiente)' });
    submitWriteMock.mockResolvedValueOnce(encolado());

    await correr(useUpdateBranch, { branch: sucursal, input: { name: 'Casa Matriz', isActive: true } });

    expect(ultimaEscritura().input).toMatchObject({
      body: { name: 'Casa Matriz' },
      expected: { name: 'Centro (pendiente)' },
    });
  });
});
