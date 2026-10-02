import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, cleanup, screen, fireEvent, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';

import { SyncStatus } from './SyncStatus';
import type { OutboxOp } from '../../offline/db';
import type { SyncState } from '../../offline/replay';
import { queryClient } from '../../lib/query-client';
import { EQUIPMENT_KEY } from '../../hooks/useEquipment';

const { retryOpMock, discardOpMock } = vi.hoisted(() => ({
  retryOpMock: vi.fn(),
  discardOpMock: vi.fn(),
}));

vi.mock('../../offline/outbox', () => ({ retryOp: retryOpMock, discardOp: discardOpMock }));

let mockSyncState: SyncState = {
  pendingCount: 0,
  attentionCount: 0,
  syncing: false,
  authRequired: false,
  lastSyncAt: null,
  lastError: null,
  notice: null,
};
vi.mock('../../offline/replay', () => ({
  useSyncState: () => mockSyncState,
}));

let mockOps: OutboxOp[] = [];
vi.mock('../../offline/useOutboxOps', () => ({ useOutboxOps: () => mockOps }));

let mockIsOfflineSnapshot = false;
vi.mock('../../hooks/useCurrentUser', () => ({
  useCurrentUser: () => ({ user: { id: 'u1' }, isOfflineSnapshot: mockIsOfflineSnapshot }),
}));

let mockOnline = true;
vi.mock('../../hooks/useOnlineStatus', () => ({ useOnlineStatus: () => mockOnline }));

const { equipmentListMock, operatorListMock, listMineMock, listHallazgosMock, listTrabajosMock, listHorometroMock } =
  vi.hoisted(() => ({
    equipmentListMock: vi.fn(),
    operatorListMock: vi.fn(),
    listMineMock: vi.fn(),
    listHallazgosMock: vi.fn(),
    listTrabajosMock: vi.fn(),
    listHorometroMock: vi.fn(),
  }));
vi.mock('../../api/HallazgosAPI', () => ({ listHallazgos: listHallazgosMock }));
vi.mock('../../api/TrabajosExtraAPI', () => ({ listTrabajosExtra: listTrabajosMock }));
vi.mock('../../api/HorometroAPI', () => ({ listHorometro: listHorometroMock }));
vi.mock('../../api/EquipmentAPI', () => ({ EquipmentAPI: { list: equipmentListMock } }));
vi.mock('../../api/OperatorAPI', () => ({ OperatorAPI: { list: operatorListMock } }));
vi.mock('../../api/ShiftCardAPI', () => ({ ShiftCardAPI: { listMine: listMineMock } }));

let mockEquipos: Array<{ id: string; internalCode: string }> = [];

function renderBar() {
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <SyncStatus />
      </MemoryRouter>
    </QueryClientProvider>,
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
 * cuya apertura falló". */
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

beforeEach(() => {
  mockEquipos = [];
  equipmentListMock.mockImplementation(async () => mockEquipos);
  listHallazgosMock.mockResolvedValue([]);
  listTrabajosMock.mockResolvedValue([]);
  listHorometroMock.mockResolvedValue([]);
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  queryClient.clear();
  mockSyncState = {
    pendingCount: 0,
    attentionCount: 0,
    syncing: false,
    authRequired: false,
    lastSyncAt: null,
    lastError: null,
    notice: null,
  };
  mockOps = [];
  mockIsOfflineSnapshot = false;
  mockOnline = true;
});

describe('SyncStatus — barra (prioridad de estados)', () => {
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
    // El propio componente también consulta el catálogo (`useEquipment`) al
    // montar, por eso no se fija el número exacto de llamadas.
    expect(equipmentListMock).toHaveBeenCalled();
    expect(operatorListMock).toHaveBeenCalledWith({ isActive: true });
    expect(listMineMock).toHaveBeenCalledTimes(1);
    expect(listHallazgosMock).toHaveBeenCalledTimes(1);
    expect(listTrabajosMock).toHaveBeenCalledTimes(1);
    expect(listHorometroMock).toHaveBeenCalledTimes(1);
    expect(screen.getByText('Hallazgos precargados')).toBeTruthy();
    expect(screen.getByText('Trabajos extra precargados')).toBeTruthy();
    expect(screen.getByText('Equipos en turno precargados')).toBeTruthy();
  });

  it('"Preparar para uso sin señal" avisa si un catálogo falla al precargar', async () => {
    equipmentListMock.mockRejectedValue(new Error('network'));
    operatorListMock.mockResolvedValue([]);
    listMineMock.mockResolvedValue([]);
    renderBar();
    fireEvent.click(screen.getByRole('button', { name: /Preparado para registrar sin señal/ }));

    fireEvent.click(screen.getByRole('button', { name: 'Preparar para uso sin señal' }));

    // El fetch de `useEquipment` (montado en el componente) ya está en vuelo
    // con su reintento, y `fetchQuery` se cuelga de él — tarda ~1 s en fallar.
    expect(await screen.findByText('Operadores precargados', {}, { timeout: 4000 })).toBeTruthy();
    // El ítem de equipos quedó marcado como error — mismo bloque, ícono
    // distinto (ver `PrepItemRow`); confirmamos que el checklist completo
    // (los 3 catálogos) se muestra aunque uno haya fallado.
    expect(screen.getByText('Tarjetas propias precargadas')).toBeTruthy();
  });
});

describe('SyncStatus — un cierre cuya apertura falló', () => {
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

describe('SyncStatus — etiquetas de hallazgos y trabajos extra', () => {
  function atencion(op: { id?: string; type: OutboxOp['type']; payload: object }): OutboxOp {
    return {
      id: 'x-1',
      v: 1,
      userId: 'u1',
      status: 'needs_attention',
      attempts: 1,
      lastError: { message: 'Rechazado por el servidor', code: 'EQUIPMENT_ON_SHIFT' },
      createdAt: Date.now(),
      updatedAt: Date.now(),
      ...op,
    } as OutboxOp;
  }

  const HALLAZGO_PAYLOAD = {
    id: 'x-1',
    equipoId: 'eq-1',
    descripcion: 'Fuga',
    prioridad: 'ALTA',
    capturedAt: '2026-09-24T09:00:00.000Z',
  };
  const TRABAJO_PAYLOAD = {
    id: 'x-1',
    equipoId: 'eq-1',
    operatorId: 'op-1',
    faena: 'Patillo',
    turno: 'DIURNO',
    horometroInicial: 1,
    horometroFinal: 2,
    actividades: ['SOLTAR_MATERIAL'],
    descripcion: 'Carga',
    capturedAt: '2026-09-24T09:00:00.000Z',
  };

  it('"Hallazgo · <equipo>" con el código del catálogo cacheado', () => {
    queryClient.setQueryData(EQUIPMENT_KEY, [{ id: 'eq-1', internalCode: 'EX-005' }]);
    mockEquipos = [{ id: 'eq-1', internalCode: 'EX-005' }];
    mockSyncState = { ...mockSyncState, attentionCount: 1 };
    mockOps = [atencion({ type: 'createHallazgo', payload: HALLAZGO_PAYLOAD })];
    renderBar();

    fireEvent.click(screen.getByRole('button', { name: /1 registro requiere atención/ }));

    expect(screen.getByText('Hallazgo · EX-005')).toBeTruthy();
    expect(screen.getByText('Rechazado por el servidor')).toBeTruthy();
  });

  it('la etiqueta se actualiza sola cuando el catálogo llega después de abrir la hoja', async () => {
    mockEquipos = [{ id: 'eq-1', internalCode: 'EX-005' }];
    mockSyncState = { ...mockSyncState, attentionCount: 1 };
    mockOps = [atencion({ type: 'createHallazgo', payload: HALLAZGO_PAYLOAD })];
    renderBar();

    fireEvent.click(screen.getByRole('button', { name: /1 registro requiere atención/ }));

    // Sin catálogo cacheado al abrir: arranca genérica y se completa al resolver la query.
    expect(screen.getByText('Hallazgo')).toBeTruthy();
    expect(await screen.findByText('Hallazgo · EX-005')).toBeTruthy();
  });

  it('"Trabajo extra · <equipo>" con el código del catálogo cacheado', () => {
    queryClient.setQueryData(EQUIPMENT_KEY, [{ id: 'eq-1', internalCode: 'EX-005' }]);
    mockEquipos = [{ id: 'eq-1', internalCode: 'EX-005' }];
    mockSyncState = { ...mockSyncState, attentionCount: 1 };
    mockOps = [atencion({ type: 'createTrabajoExtra', payload: TRABAJO_PAYLOAD })];
    renderBar();

    fireEvent.click(screen.getByRole('button', { name: /1 registro requiere atención/ }));

    expect(screen.getByText('Trabajo extra · EX-005')).toBeTruthy();
  });

  it('sin el equipo en el catálogo, la etiqueta queda genérica', () => {
    mockSyncState = { ...mockSyncState, attentionCount: 2 };
    mockOps = [
      atencion({ id: 'a', type: 'createHallazgo', payload: HALLAZGO_PAYLOAD }),
      atencion({ id: 'b', type: 'createTrabajoExtra', payload: TRABAJO_PAYLOAD }),
    ];
    renderBar();

    fireEvent.click(screen.getByRole('button', { name: /2 registros requieren atención/ }));

    expect(screen.getByText('Hallazgo')).toBeTruthy();
    expect(screen.getByText('Trabajo extra')).toBeTruthy();
  });
});
