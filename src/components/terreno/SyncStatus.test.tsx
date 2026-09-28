import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, cleanup, screen, fireEvent, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

import { SyncStatus } from './SyncStatus';
import type { OutboxOp } from '../../offline/db';
import type { SyncState } from '../../offline/replay';

const { retryOpMock, discardOpMock, useSyncEngineMock } = vi.hoisted(() => ({
  retryOpMock: vi.fn(),
  discardOpMock: vi.fn(),
  useSyncEngineMock: vi.fn(),
}));

vi.mock('../../offline/outbox', () => ({ retryOp: retryOpMock, discardOp: discardOpMock }));

let mockSyncState: SyncState = {
  pendingCount: 0,
  attentionCount: 0,
  syncing: false,
  authRequired: false,
  lastSyncAt: null,
  lastError: null,
};
vi.mock('../../offline/replay', () => ({
  useSyncState: () => mockSyncState,
  useSyncEngine: () => useSyncEngineMock(),
}));

let mockOps: OutboxOp[] = [];
vi.mock('../../offline/useOutboxOps', () => ({ useOutboxOps: () => mockOps }));

let mockIsOfflineSnapshot = false;
vi.mock('../../hooks/useCurrentUser', () => ({
  useCurrentUser: () => ({ user: { id: 'u1' }, isOfflineSnapshot: mockIsOfflineSnapshot }),
}));

let mockOnline = true;
vi.mock('../../hooks/useOnlineStatus', () => ({ useOnlineStatus: () => mockOnline }));

const { equipmentListMock, operatorListMock, listMineMock } = vi.hoisted(() => ({
  equipmentListMock: vi.fn(),
  operatorListMock: vi.fn(),
  listMineMock: vi.fn(),
}));
vi.mock('../../api/EquipmentAPI', () => ({ EquipmentAPI: { list: equipmentListMock } }));
vi.mock('../../api/OperatorAPI', () => ({ OperatorAPI: { list: operatorListMock } }));
vi.mock('../../api/ShiftCardAPI', () => ({ ShiftCardAPI: { listMine: listMineMock } }));

function renderBar() {
  return render(
    <MemoryRouter>
      <SyncStatus />
    </MemoryRouter>,
  );
}

function attentionOp(overrides: Partial<OutboxOp> = {}): OutboxOp {
  return {
    id: 'op-1',
    type: 'openCard',
    v: 1,
    userId: 'u1',
    status: 'needs_attention',
    attempts: 1,
    lastError: { message: 'CA-011 está ocupado por Marcela Pizarro', code: 'EQUIPMENT_BUSY' },
    createdAt: Date.now(),
    updatedAt: Date.now(),
    payload: {
      id: 'op-1',
      equipoId: 'eq-1',
      operatorId: 'op-1',
      valorInicial: 1,
      shiftDate: '2026-09-24',
      shiftType: 'DIURNO',
      capturedAt: 't',
    },
    ...overrides,
  } as OutboxOp;
}

/** Un `closeCard` pendiente que depende del `openCard` de `attentionOp()`
 * (misma `cardId` = `'op-1'`, el `id` de esa apertura) — el caso "un cierre
 * cuya apertura falló" (revisión QA). */
function pendingCloseOp(overrides: Partial<OutboxOp> = {}): OutboxOp {
  return {
    id: 'close-1',
    type: 'closeCard',
    v: 1,
    userId: 'u1',
    status: 'pending_upload',
    attempts: 0,
    photoId: 'close-1',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    payload: {
      cardId: 'op-1',
      input: { closeClientId: 'close-1', valorFinal: 130, fuelLiters: 20, capturedAt: '2026-09-24T16:00:00.000Z' },
    },
    ...overrides,
  } as OutboxOp;
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  mockSyncState = {
    pendingCount: 0,
    attentionCount: 0,
    syncing: false,
    authRequired: false,
    lastSyncAt: null,
    lastError: null,
  };
  mockOps = [];
  mockIsOfflineSnapshot = false;
  mockOnline = true;
});

describe('SyncStatus — barra (prioridad de estados)', () => {
  it('monta el motor de sync (useSyncEngine) — un único lugar de la app', () => {
    renderBar();
    expect(useSyncEngineMock).toHaveBeenCalledTimes(1);
  });

  it('authRequired tiene la MÁXIMA prioridad', () => {
    mockSyncState = { ...mockSyncState, authRequired: true, pendingCount: 3 };
    renderBar();
    expect(screen.getByRole('button', { name: /Tu sesión expiró/ })).toBeTruthy();
  });

  it('isOfflineSnapshot: "Sin señal · sesión guardada"', () => {
    mockIsOfflineSnapshot = true;
    renderBar();
    expect(screen.getByRole('button', { name: /Sin señal.*sesión guardada/ })).toBeTruthy();
  });

  it('con operaciones needs_attention, "N requieren atención"', () => {
    mockSyncState = { ...mockSyncState, attentionCount: 2 };
    renderBar();
    expect(screen.getByRole('button', { name: /2 registros requieren atención/ })).toBeTruthy();
  });

  it('sincronizando, "Sincronizando…"', () => {
    mockSyncState = { ...mockSyncState, syncing: true };
    renderBar();
    expect(screen.getByRole('button', { name: /Sincronizando…/ })).toBeTruthy();
  });

  it('con pendientes, "N registros por sincronizar"', () => {
    mockSyncState = { ...mockSyncState, pendingCount: 2 };
    renderBar();
    expect(screen.getByRole('button', { name: /2 registros por sincronizar/ })).toBeTruthy();
  });

  it('sin señal y nada pendiente todavía, la promesa neutra de siempre', () => {
    mockOnline = false;
    renderBar();
    expect(screen.getByRole('button', { name: /Sin señal.*se envía solo al volver la conexión/ })).toBeTruthy();
  });

  it('en línea, sin nada pendiente y ya sincronizó una vez, "Todo sincronizado · HH:MM"', () => {
    mockSyncState = { ...mockSyncState, lastSyncAt: new Date(2026, 8, 24, 8, 41).getTime() };
    renderBar();
    expect(screen.getByRole('button', { name: /Todo sincronizado · 08:41/ })).toBeTruthy();
  });
});

describe('SyncStatus — hoja de detalle', () => {
  it('tocar la barra abre la hoja con el contador de pendientes', () => {
    mockSyncState = { ...mockSyncState, pendingCount: 4 };
    renderBar();

    fireEvent.click(screen.getByRole('button', { name: /4 registros por sincronizar/ }));

    const dialog = screen.getByRole('dialog', { name: 'Sincronización' });
    expect(within(dialog).getByText('4')).toBeTruthy();
  });

  it('lista las operaciones needs_attention con su mensaje de error', () => {
    mockSyncState = { ...mockSyncState, attentionCount: 1 };
    mockOps = [attentionOp()];
    renderBar();

    fireEvent.click(screen.getByRole('button', { name: /1 registro requiere atención/ }));

    expect(screen.getByText('Apertura de tarjeta')).toBeTruthy();
    expect(screen.getByText('CA-011 está ocupado por Marcela Pizarro')).toBeTruthy();
  });

  it('"Reintentar" llama a retryOp con el id de la operación y el userId de la sesión', () => {
    mockSyncState = { ...mockSyncState, attentionCount: 1 };
    mockOps = [attentionOp()];
    renderBar();
    fireEvent.click(screen.getByRole('button', { name: /1 registro requiere atención/ }));

    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));

    expect(retryOpMock).toHaveBeenCalledWith('op-1', 'u1');
  });

  it('"Descartar" pide confirmación antes de llamar a discardOp', () => {
    mockSyncState = { ...mockSyncState, attentionCount: 1 };
    mockOps = [attentionOp()];
    renderBar();
    fireEvent.click(screen.getByRole('button', { name: /1 registro requiere atención/ }));

    fireEvent.click(screen.getByRole('button', { name: 'Descartar' }));
    expect(discardOpMock).not.toHaveBeenCalled();
    expect(screen.getByText(/No se puede deshacer/)).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Sí, descartar' }));
    expect(discardOpMock).toHaveBeenCalledWith('op-1', 'u1');
  });

  it('"Cancelar" en la confirmación de descarte no llama a discardOp', () => {
    mockSyncState = { ...mockSyncState, attentionCount: 1 };
    mockOps = [attentionOp()];
    renderBar();
    fireEvent.click(screen.getByRole('button', { name: /1 registro requiere atención/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Descartar' }));

    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));

    expect(discardOpMock).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Descartar' })).toBeTruthy();
  });

  it('authRequired: la hoja ofrece un link a /login', () => {
    mockSyncState = { ...mockSyncState, authRequired: true };
    renderBar();
    fireEvent.click(screen.getByRole('button', { name: /Tu sesión expiró/ }));

    const link = screen.getByRole('link', { name: 'Iniciar sesión' });
    expect(link.getAttribute('href')).toBe('/login');
  });

  it('"Preparar para uso sin señal" precarga equipos/operadores/tarjetas y muestra el checklist', async () => {
    equipmentListMock.mockResolvedValue([]);
    operatorListMock.mockResolvedValue([]);
    listMineMock.mockResolvedValue([]);
    renderBar();
    fireEvent.click(screen.getByRole('button', { name: /Preparado para registrar sin señal/ }));

    fireEvent.click(screen.getByRole('button', { name: 'Preparar para uso sin señal' }));

    expect(await screen.findByText('Equipos precargados')).toBeTruthy();
    expect(equipmentListMock).toHaveBeenCalledTimes(1);
    expect(operatorListMock).toHaveBeenCalledWith({ isActive: true });
    expect(listMineMock).toHaveBeenCalledTimes(1);
  });

  it('"Preparar para uso sin señal" avisa si un catálogo falla al precargar', async () => {
    equipmentListMock.mockRejectedValue(new Error('network'));
    operatorListMock.mockResolvedValue([]);
    listMineMock.mockResolvedValue([]);
    renderBar();
    fireEvent.click(screen.getByRole('button', { name: /Preparado para registrar sin señal/ }));

    fireEvent.click(screen.getByRole('button', { name: 'Preparar para uso sin señal' }));

    expect(await screen.findByText('Operadores precargados')).toBeTruthy();
    // El ítem de equipos quedó marcado como error — mismo bloque, ícono
    // distinto (ver `PrepItemRow`); confirmamos que el checklist completo
    // (los 3 catálogos) se muestra aunque uno haya fallado.
    expect(screen.getByText('Tarjetas propias precargadas')).toBeTruthy();
  });
});

describe('SyncStatus — un cierre cuya apertura falló (revisión QA)', () => {
  it('avisa que la tarjeta también tiene un cierre guardado esperando la apertura', () => {
    mockSyncState = { ...mockSyncState, attentionCount: 1 };
    mockOps = [attentionOp(), pendingCloseOp()];
    renderBar();

    fireEvent.click(screen.getByRole('button', { name: /1 registro requiere atención/ }));

    expect(screen.getByText(/también tiene un cierre guardado \(con foto\)/)).toBeTruthy();
  });

  it('sin cierre dependiente, no muestra ese aviso', () => {
    mockSyncState = { ...mockSyncState, attentionCount: 1 };
    mockOps = [attentionOp()];
    renderBar();

    fireEvent.click(screen.getByRole('button', { name: /1 registro requiere atención/ }));

    expect(screen.queryByText(/también tiene un cierre guardado/)).toBeNull();
  });

  it('"Descartar" sobre esa apertura avisa explícito que también se pierde el cierre', () => {
    mockSyncState = { ...mockSyncState, attentionCount: 1 };
    mockOps = [attentionOp(), pendingCloseOp()];
    renderBar();
    fireEvent.click(screen.getByRole('button', { name: /1 registro requiere atención/ }));

    fireEvent.click(screen.getByRole('button', { name: 'Descartar' }));

    expect(screen.getByText(/Se descarta la apertura y también su cierre guardado con la foto/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Sí, descartar' }));
    expect(discardOpMock).toHaveBeenCalledWith('op-1', 'u1');
  });
});
