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
  resumenMock,
  movementsMock,
  notifListMock,
  notifUnreadMock,
  intervencionesListMock,
  combustibleListMock,
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
  resumenMock: vi.fn(),
  movementsMock: vi.fn(),
  notifListMock: vi.fn(),
  notifUnreadMock: vi.fn(),
  intervencionesListMock: vi.fn(),
  combustibleListMock: vi.fn(),
}));

vi.mock('../api/EquipmentAPI', () => ({ EquipmentAPI: { list: equipmentListMock, resumen: resumenMock } }));
vi.mock('../api/CombustibleAPI', () => ({ listCombustible: combustibleListMock }));
vi.mock('../api/NotificacionAPI', () => ({ NotificacionAPI: { list: notifListMock, unreadCount: notifUnreadMock } }));
vi.mock('../api/OperatorAPI', () => ({ OperatorAPI: { list: operatorListMock } }));
vi.mock('../api/ShiftCardAPI', () => ({ ShiftCardAPI: { listMine: listMineMock } }));
vi.mock('../api/HallazgosAPI', () => ({ listHallazgos: listHallazgosMock }));
vi.mock('../api/TrabajosExtraAPI', () => ({ listTrabajosExtra: listTrabajosMock }));
vi.mock('../api/HorometroAPI', () => ({ listHorometro: listHorometroMock }));
vi.mock('../api/BranchAPI', () => ({ BranchAPI: { list: branchListMock } }));
vi.mock('../api/CategoryAPI', () => ({ CategoryAPI: { list: categoryListMock } }));
vi.mock('../api/InventoryAPI', () => ({ InventoryAPI: { listItems: itemsListMock, listMovements: movementsMock } }));
vi.mock('../api/MantenimientoAPI', () => ({
  OrdenesAPI: { list: ordenesListMock },
  ActividadesAPI: { list: actividadesListMock },
  UmbralesAPI: { list: umbralesListMock },
  IntervencionesAPI: { list: intervencionesListMock },
}));

import { usePrepareOffline } from './usePrepareOffline';
import { queryClient } from '../lib/query-client';
import {
  ACTIVIDADES_KEY,
  BRANCHES_KEY,
  EQUIPMENT_KEY,
  HALLAZGOS_KEY,
  COMBUSTIBLE_KEY,
  HOROMETRO_KEY,
  INTERVENCIONES_KEY,
  INVENTORY_KEY,
  OPERATORS_KEY,
  ORDENES_KEY,
  SHIFT_CARDS_MINE_KEY,
  TRABAJOS_EXTRA_KEY,
  UMBRALES_KEY,
} from '../lib/query-keys';
import { BITACORA_ORDENES_PRECARGADAS, PREP_KEYS } from '../config/offline-prep';
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
  resumenMock.mockResolvedValue({ total: 3 });
  movementsMock.mockResolvedValue([{ id: 'mv-1' }]);
  notifListMock.mockResolvedValue([{ id: 'n-1' }]);
  notifUnreadMock.mockResolvedValue(2);
  intervencionesListMock.mockResolvedValue([{ id: 'in-1' }]);
  combustibleListMock.mockResolvedValue([{ id: 'cb-1' }]);
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

describe('usePrepareOffline — modo sin señal y almacenamiento', () => {
  function stubServiceWorker(controller: object | null) {
    Object.defineProperty(navigator, 'serviceWorker', { value: { controller }, configurable: true });
  }
  function stubStorage(storage: { persist: () => Promise<boolean>; persisted?: () => Promise<boolean> }) {
    Object.defineProperty(navigator, 'storage', { value: storage, configurable: true });
  }

  afterEach(() => {
    Reflect.deleteProperty(navigator, 'serviceWorker');
    Reflect.deleteProperty(navigator, 'storage');
  });

  async function preparar() {
    const { result } = renderHook(() => usePrepareOffline(ROLES.ADMIN));
    await act(async () => {
      await result.current.handlePreparar();
    });
    return result.current.resultadoPrep!;
  }

  it('si el service worker NO controla la página, el resultado lo dice (lo precargado no quedó para el modo sin señal)', async () => {
    stubServiceWorker(null);

    const resultado = await preparar();

    expect(resultado.serviceWorker).toBe('error');
    expect(resultado.equipment).toBe('ok');
  });

  it('si el service worker controla la página, lo marca ok', async () => {
    stubServiceWorker({});

    expect((await preparar()).serviceWorker).toBe('ok');
  });

  it('pide almacenamiento persistente y lo reporta; si ya lo era, no vuelve a pedirlo', async () => {
    const persist = vi.fn().mockResolvedValue(true);
    stubStorage({ persist, persisted: vi.fn().mockResolvedValue(false) });
    expect((await preparar()).persist).toBe('ok');
    expect(persist).toHaveBeenCalledTimes(1);

    const persistDeNuevo = vi.fn();
    stubStorage({ persist: persistDeNuevo, persisted: vi.fn().mockResolvedValue(true) });
    expect((await preparar()).persist).toBe('ok');
    expect(persistDeNuevo).not.toHaveBeenCalled();
  });

  it('si el navegador lo niega, persist es error (la hoja lo muestra como aviso)', async () => {
    stubStorage({ persist: vi.fn().mockResolvedValue(false) });

    expect((await preparar()).persist).toBe('error');
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

    for (const key of PREP_KEYS) {
      expect(resultado[key], key).toBe('ok');
    }
  });

  it('suma el panel, las notificaciones, los movimientos y la bitácora bajo las keys de las pantallas', async () => {
    const resultado = await preparar(ROLES.ADMIN);

    expect(resultado).toMatchObject({ dashboard: 'ok', notificaciones: 'ok', movimientos: 'ok', bitacora: 'ok' });
    expect(queryClient.getQueryData([...EQUIPMENT_KEY, 'resumen'])).toEqual({ total: 3 });
    expect(queryClient.getQueryData(['notificaciones'])).toEqual([{ id: 'n-1' }]);
    expect(queryClient.getQueryData(['notificaciones', 'unread'])).toBe(2);
    expect(queryClient.getQueryData([...INVENTORY_KEY, 'movements', { limit: 200 }])).toEqual([{ id: 'mv-1' }]);
    expect(movementsMock).toHaveBeenCalledWith({ limit: 200 });
    expect(queryClient.getQueryData([...INTERVENCIONES_KEY, 'ot-1'])).toEqual([{ id: 'in-1' }]);
    expect(intervencionesListMock).toHaveBeenCalledWith('ot-1');
  });

  it('la bitácora se precarga solo para las órdenes más recientes', async () => {
    ordenesListMock.mockResolvedValue(Array.from({ length: 40 }, (_, i) => ({ id: 'ot-' + String(i) })));

    await preparar(ROLES.MANTENEDOR);

    expect(intervencionesListMock).toHaveBeenCalledTimes(BITACORA_ORDENES_PRECARGADAS);
    expect(intervencionesListMock).toHaveBeenCalledWith('ot-0');
    expect(intervencionesListMock).not.toHaveBeenCalledWith('ot-' + String(BITACORA_ORDENES_PRECARGADAS));
  });

  it('MANTENEDOR: panel, notificaciones, movimientos y bitácora sí; combustible no (es de Terreno)', async () => {
    const resultado = await preparar(ROLES.MANTENEDOR);

    expect(resultado).toMatchObject({ dashboard: 'ok', notificaciones: 'ok', movimientos: 'ok', bitacora: 'ok' });
    expect(resultado.combustible).toBeUndefined();
    expect(combustibleListMock).not.toHaveBeenCalled();
  });

  it('SUPERVISOR: combustible sí; bitácora no (no ve Mantenimiento)', async () => {
    const resultado = await preparar(ROLES.SUPERVISOR);

    expect(resultado.combustible).toBe('ok');
    expect(queryClient.getQueryData(COMBUSTIBLE_KEY)).toEqual([{ id: 'cb-1' }]);
    expect(resultado.bitacora).toBeUndefined();
    expect(intervencionesListMock).not.toHaveBeenCalled();
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
