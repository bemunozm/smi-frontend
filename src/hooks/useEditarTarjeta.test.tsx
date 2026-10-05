import 'fake-indexeddb/auto';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const { toastDangerMock, listChangesMock } = vi.hoisted(() => ({
  toastDangerMock: vi.fn(),
  listChangesMock: vi.fn(),
}));

vi.mock('@heroui/react', () => ({ toast: { danger: toastDangerMock, success: vi.fn() } }));
vi.mock('../api/ShiftCardAPI', () => ({ ShiftCardAPI: { listChanges: listChangesMock } }));

let enLinea = true;
vi.mock('./useOnlineStatus', () => ({ useOnlineStatus: () => enLinea }));

import { useEditarTarjeta } from './useEditarTarjeta';
import type { TarjetaTurno } from './shift-register-helpers';
import { db, type OutboxOp } from '../offline/db';

const abierta: TarjetaTurno = {
  id: 'c1',
  equipo: 'EX-005',
  tipo: 'Excavadora',
  operador: 'Patricio Rojas',
  operatorId: 'op-1',
  inicial: 100,
  adBlue: false,
  grupo: 'actual',
  estado: 'curso',
  supervisor: 'Ana Soto',
};

const cerrada: TarjetaTurno = {
  ...abierta,
  final: 130,
  litros: 20,
  adBlue: true,
  adBlueLitros: 12,
  estado: 'cerrada',
  observaciones: 'Todo bien — sin novedades',
};

function wrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: ReactNode }) => <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

async function opsActuales(): Promise<OutboxOp[]> {
  return db.outbox.orderBy('seq').toArray();
}

function render(tarjeta: TarjetaTurno, ops: OutboxOp[] = []) {
  return renderHook(() => useEditarTarjeta({ tarjetas: [tarjeta], ops, userId: 'u1' }), { wrapper: wrapper() });
}

function openOp(): OutboxOp {
  return {
    id: 'c1', type: 'openCard', v: 1, userId: 'u1', status: 'pending', attempts: 0, seq: 1, createdAt: 1, updatedAt: 1,
    entityKey: 'shift-card:c1',
    payload: { id: 'c1', equipoId: 'e1', operatorId: 'op-1', valorInicial: 100, shiftDate: '2026-09-24', shiftType: 'DIURNO', capturedAt: 't' },
  };
}

function closeOp(status: OutboxOp['status'] = 'pending_upload'): OutboxOp {
  return {
    id: 'close-1', type: 'closeCard', v: 1, userId: 'u1', status, attempts: 0, photoId: 'close-1', seq: 2, createdAt: 2, updatedAt: 2,
    entityKey: 'shift-card:c1', dependsOn: ['c1'],
    payload: { cardId: 'c1', input: { closeClientId: 'close-1', valorFinal: 130, fuelLiters: 20, capturedAt: 't' } },
  };
}

beforeEach(async () => {
  enLinea = true;
  listChangesMock.mockResolvedValue([]);
  await db.outbox.clear();
});

afterEach(() => vi.clearAllMocks());

describe('useEditarTarjeta — tarjeta ya en el servidor', () => {
  it('encola un PATCH con solo los campos tocados y su valor base como precondición', async () => {
    const { result } = render(abierta);
    act(() => result.current.abrirEdicion('c1'));
    act(() => result.current.setForm((f) => ({ ...f, operatorId: 'op-2', observaciones: ' Cambio de turno ' })));

    await act(async () => {
      await result.current.guardar();
    });

    const [op] = await opsActuales();
    expect(op).toMatchObject({
      type: 'httpWrite',
      endpoint: 'shiftCard.edit',
      params: { id: 'c1' },
      body: { operatorId: 'op-2', observaciones: 'Cambio de turno' },
      expected: { operatorId: 'op-1', observaciones: '' },
      entityKey: 'shift-card:c1',
    });
    expect(Object.keys((op as { body: object }).body)).toEqual(['operatorId', 'observaciones']);
    expect(result.current.guardado).toBe(true);
  });

  it('sin tocar nada no encola y cierra', async () => {
    const { result } = render(abierta);
    act(() => result.current.abrirEdicion('c1'));

    await act(async () => {
      await result.current.guardar();
    });

    expect(await db.outbox.count()).toBe(0);
    expect(result.current.editando).toBeNull();
  });

  it('una tarjeta abierta no edita ni horómetro final, ni litros, ni AdBlue', async () => {
    const { result } = render(abierta);
    act(() => result.current.abrirEdicion('c1'));
    act(() => result.current.setForm((f) => ({ ...f, final: '999', litros: '99', adBlue: true, adBlueLitros: '5', inicial: '101' })));

    await act(async () => {
      await result.current.guardar();
    });

    const [op] = await opsActuales();
    expect((op as { body: object }).body).toEqual({ valorInicial: 101 });
  });

  it('cerrada: apagar AdBlue manda adBlue:false SIN litros (el servidor los borra) y espera adBlue:true', async () => {
    const { result } = render(cerrada);
    act(() => result.current.abrirEdicion('c1'));
    act(() => result.current.setForm((f) => ({ ...f, adBlue: false })));

    await act(async () => {
      await result.current.guardar();
    });

    const [op] = await opsActuales();
    expect(op).toMatchObject({ body: { adBlue: false }, expected: { adBlue: true } });
    expect((op as { body: object }).body).not.toHaveProperty('adBlueLiters');
  });

  it('cerrada: la precondición conserva el texto original con caracteres no Latin-1', async () => {
    const { result } = render(cerrada);
    act(() => result.current.abrirEdicion('c1'));
    act(() => result.current.setForm((f) => ({ ...f, observaciones: 'Otra' })));

    await act(async () => {
      await result.current.guardar();
    });

    expect(await opsActuales()).toMatchObject([{ expected: { observaciones: 'Todo bien — sin novedades' } }]);
  });

  it('validaciones: final menor que el inicial y AdBlue sin litros impiden guardar', () => {
    const { result } = render(cerrada);
    act(() => result.current.abrirEdicion('c1'));

    act(() => result.current.setForm((f) => ({ ...f, final: '50' })));
    expect(result.current.finalInvalido).toBe(true);
    expect(result.current.puedeGuardar).toBe(false);

    act(() => result.current.setForm((f) => ({ ...f, final: '130', adBlueLitros: '' })));
    expect(result.current.adBlue.error).toMatch(/litros/);
    expect(result.current.puedeGuardar).toBe(false);

    act(() => result.current.setForm((f) => ({ ...f, adBlueLitros: '45' })));
    expect(result.current.adBlue.aviso).toMatch(/30 L/);
    expect(result.current.puedeGuardar).toBe(true);
  });

  it('cerrada: dice qué falta (horómetros, litros de combustible); abierta no muestra faltante', () => {
    const { result } = render(cerrada);
    act(() => result.current.abrirEdicion('c1'));
    expect(result.current.faltante).toBeNull();

    act(() => result.current.setForm((f) => ({ ...f, final: '' })));
    expect(result.current.faltante).toBe('Faltan los horómetros.');

    act(() => result.current.setForm((f) => ({ ...f, final: '130', litros: '' })));
    expect(result.current.faltante).toBe('Indicá los litros de combustible (cero si no cargó).');
    expect(result.current.puedeGuardar).toBe(false);

    act(() => result.current.setForm((f) => ({ ...f, litros: '0' })));
    expect(result.current.faltante).toBeNull();
    expect(result.current.puedeGuardar).toBe(true);
  });

  it('el historial se pide solo con señal y para una tarjeta que el servidor conoce', async () => {
    const { result } = render(abierta);
    act(() => result.current.abrirEdicion('c1'));
    await waitFor(() => expect(listChangesMock).toHaveBeenCalledWith('c1'));
    expect(result.current.historialDisponible).toBe(true);
  });

  it('sin señal no pide el historial', async () => {
    enLinea = false;
    const { result } = render(abierta);
    act(() => result.current.abrirEdicion('c1'));

    expect(result.current.historialDisponible).toBe(false);
    expect(listChangesMock).not.toHaveBeenCalled();
  });

  it('una edición propia que espera atención bloquea editar de nuevo, con su motivo', () => {
    const { result } = render(abierta);

    expect(result.current.motivoSinEdicion({ ...abierta, edicionRequiereAtencion: true })).toMatch(/Sincronización/);
    expect(result.current.motivoSinEdicion(abierta)).toBeNull();
  });
});

describe('useEditarTarjeta — operación que pudo haber llegado al servidor', () => {
  it('apertura con error transitorio tras el envío: la edición va como PATCH con dependsOn y el payload queda igual', async () => {
    const enviada: OutboxOp = { ...openOp(), dispatched: true };
    await db.outbox.put(enviada);
    const { result } = render(abierta, [enviada]);
    act(() => result.current.abrirEdicion('c1'));
    act(() => result.current.setForm((f) => ({ ...f, operatorId: 'op-2', inicial: '105' })));

    await act(async () => {
      await result.current.guardar();
    });

    const ops = await opsActuales();
    expect(ops[0]).toMatchObject({ type: 'openCard', payload: { operatorId: 'op-1', valorInicial: 100 } });
    expect(ops[1]).toMatchObject({
      type: 'httpWrite',
      endpoint: 'shiftCard.edit',
      body: { operatorId: 'op-2', valorInicial: 105 },
      expected: { operatorId: 'op-1', valorInicial: 100 },
      dependsOn: ['c1'],
    });
  });
});

describe('useEditarTarjeta — tarjeta que todavía vive en el outbox', () => {
  it('edita la apertura pendiente en vez de encolar un PATCH; no hay historial', async () => {
    await db.outbox.put(openOp());
    const { result } = render(abierta, [openOp()]);
    act(() => result.current.abrirEdicion('c1'));
    expect(result.current.soloEnElEquipo).toBe(true);
    expect(result.current.historialDisponible).toBe(false);
    act(() => result.current.setForm((f) => ({ ...f, operatorId: 'op-2', inicial: '105' })));

    await act(async () => {
      await result.current.guardar();
    });

    const ops = await opsActuales();
    expect(ops).toHaveLength(1);
    expect(ops[0]).toMatchObject({ type: 'openCard', payload: { operatorId: 'op-2', valorInicial: 105, equipoId: 'e1' } });
    expect(listChangesMock).not.toHaveBeenCalled();
  });

  it('lo que no cabe en la apertura (observaciones) va como PATCH que depende de ella', async () => {
    await db.outbox.put(openOp());
    const { result } = render(abierta, [openOp()]);
    act(() => result.current.abrirEdicion('c1'));
    act(() => result.current.setForm((f) => ({ ...f, operatorId: 'op-2', observaciones: 'Ojo con el filtro' })));

    await act(async () => {
      await result.current.guardar();
    });

    const ops = await opsActuales();
    expect(ops[0]).toMatchObject({ type: 'openCard', payload: { operatorId: 'op-2' } });
    expect(ops[1]).toMatchObject({
      type: 'httpWrite',
      body: { observaciones: 'Ojo con el filtro' },
      dependsOn: ['c1'],
    });
    expect((ops[1] as { body: object }).body).not.toHaveProperty('operatorId');
  });

  it('con el cierre pendiente: litros, AdBlue y final se editan en el cierre; el operador va por PATCH', async () => {
    await db.outbox.bulkPut([closeOp()]);
    const pendiente = { ...cerrada, adBlue: false, adBlueLitros: undefined, sinSincronizar: true };
    const { result } = render(pendiente, [closeOp()]);
    act(() => result.current.abrirEdicion('c1'));
    act(() => result.current.setForm((f) => ({ ...f, final: '135', litros: '25', adBlue: true, adBlueLitros: '10', operatorId: 'op-2' })));

    await act(async () => {
      await result.current.guardar();
    });

    const ops = await opsActuales();
    expect(ops[0]).toMatchObject({
      type: 'closeCard',
      payload: { input: { valorFinal: 135, fuelLiters: 25, adBlue: true, adBlueLiters: 10 } },
    });
    // La apertura ya viajó: solo el operador necesita un PATCH, detrás del cierre.
    expect(ops[1]).toMatchObject({ type: 'httpWrite', body: { operatorId: 'op-2' }, dependsOn: ['close-1'] });
    expect(ops).toHaveLength(2);
  });

  it('un cierre en vuelo (syncing) no se toca: el cambio se encola como PATCH detrás de él', async () => {
    await db.outbox.put(closeOp('syncing'));
    const { result } = render({ ...cerrada, adBlue: false, adBlueLitros: undefined }, [closeOp('syncing')]);
    act(() => result.current.abrirEdicion('c1'));
    act(() => result.current.setForm((f) => ({ ...f, litros: '30' })));

    await act(async () => {
      await result.current.guardar();
    });

    const ops = await opsActuales();
    expect(ops[0]).toMatchObject({ type: 'closeCard', payload: { input: { fuelLiters: 20 } } });
    expect(ops[1]).toMatchObject({
      type: 'httpWrite',
      body: { fuelLiters: 30 },
      expected: { fuelLiters: 20 },
      dependsOn: ['close-1'],
    });
  });
});
