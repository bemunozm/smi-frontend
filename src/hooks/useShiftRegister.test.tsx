import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { aNumero, lineaEstadoCorreo, mapCardToTarjeta, useShiftRegister } from './useShiftRegister';
import { contextoTurno } from '../lib/turno';
import { ROLES } from '../types/roles';
import type { OutboxOp } from '../offline/db';
import type { ShiftCardResponse } from '../types/shift';

// --- Mocks de las dependencias del hook -------------------------------------

let mockUser: { id: string; name: string; email: string } | null = {
  id: 'u1',
  name: 'Ana Soto',
  email: 'ana@smi.local',
};
let mockRole: (typeof ROLES)[keyof typeof ROLES] | null = ROLES.SUPERVISOR;

vi.mock('./useCurrentUser', () => ({
  useCurrentUser: () => ({ user: mockUser, role: mockRole }),
}));

const {
  equipmentListMock,
  operatorListMock,
  listMineMock,
  enqueueOpenCardMock,
  enqueueCloseCardMock,
  enqueueExitReportMock,
  resetPhotoMock,
} = vi.hoisted(() => ({
  equipmentListMock: vi.fn(),
  operatorListMock: vi.fn(),
  listMineMock: vi.fn(),
  enqueueOpenCardMock: vi.fn(),
  enqueueCloseCardMock: vi.fn(),
  enqueueExitReportMock: vi.fn(),
  resetPhotoMock: vi.fn(),
}));

vi.mock('../api/EquipmentAPI', () => ({ EquipmentAPI: { list: equipmentListMock } }));
vi.mock('../api/OperatorAPI', () => ({ OperatorAPI: { list: operatorListMock } }));
vi.mock('../api/ShiftCardAPI', () => ({ ShiftCardAPI: { listMine: listMineMock } }));
vi.mock('../api/ShiftReportAPI', () => ({
  ShiftReportAPI: { fileUrl: (id: string) => `/api/shift-reports/${id}/file` },
}));
vi.mock('../offline/outbox', () => ({
  enqueueOpenCard: enqueueOpenCardMock,
  enqueueCloseCard: enqueueCloseCardMock,
  enqueueExitReport: enqueueExitReportMock,
}));

// El outbox EN VIVO se controla con esta variable de módulo — cada test la
// puebla con los `OutboxOp` que necesite antes de renderizar el hook.
let mockOps: OutboxOp[] = [];
vi.mock('../offline/useOutboxOps', () => ({
  useOutboxOps: () => mockOps,
}));

// El flujo foto→OCR→subida ya tiene sus propios tests (Flota) — acá se
// mockea entero para controlar `file`/`captureDate` sin simular una
// selección de archivo real. `upload` ya NO lo llama `useShiftRegister`
// (la subida pasa al replay) — sigue en el doble por si algún test lo
// inspecciona, pero nada lo invoca.
let mockFotoFile: File | null = null;
vi.mock('../lib/usePhotoCaptureFlow', () => ({
  usePhotoCaptureFlow: () => ({
    file: mockFotoFile,
    isReadingPhoto: false,
    isUploadingPhoto: false,
    captureDate: null,
    ocr: null,
    handleSelectPhoto: vi.fn(),
    handleClearPhoto: vi.fn(),
    resetPhoto: resetPhotoMock,
    cancelar: vi.fn(),
    upload: vi.fn(),
  }),
}));

vi.mock('@heroui/react', () => ({ toast: { danger: vi.fn(), success: vi.fn() } }));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.useRealTimers();
  mockUser = { id: 'u1', name: 'Ana Soto', email: 'ana@smi.local' };
  mockRole = ROLES.SUPERVISOR;
  mockFotoFile = null;
  mockOps = [];
  window.localStorage.clear();
});

const EQUIPO: {
  id: string;
  internalCode: string;
  type: string;
  status: string;
  currentHourmeter: number | null;
  openShift: { supervisorName: string | null } | null;
} = {
  id: 'eq_1',
  internalCode: 'EX-005',
  type: 'Excavadora',
  status: 'OPERATIONAL',
  currentHourmeter: 4218.7,
  openShift: null,
};

const CARD_ABIERTA_ACTUAL: ShiftCardResponse = {
  id: 'c1',
  equipoId: 'eq_1',
  equipo: { internalCode: 'EX-005', type: 'Excavadora', controlUnit: 'HOURS' },
  operatorId: 'op_1',
  operatorName: 'Patricio Rojas',
  supervisorId: 'u1',
  supervisorName: 'Ana Soto',
  shift: { id: 'sh_1', date: '2026-09-24', type: 'DIURNO', exitReports: [] },
  valorInicial: 100,
  valorFinal: null,
  horasMaquina: null,
  fuelLiters: null,
  pumpPhotoUrl: null,
  observaciones: null,
  belowPreviousReading: false,
  fecha: '2026-09-24T09:00:00.000Z',
  fechaSalida: null,
  createdAt: '2026-09-24T09:00:00.000Z',
  closedAt: null,
};

function withQueryClient() {
  const queryClient = new QueryClient();
  return {
    queryClient,
    Wrapper: ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    ),
  };
}

function mockApis({
  equipos = [EQUIPO],
  operadores = [{ id: 'op_1', name: 'Patricio Rojas', rut: null, isActive: true, createdAt: '', updatedAt: '' }],
  tarjetas = [] as ShiftCardResponse[],
} = {}) {
  equipmentListMock.mockResolvedValue(equipos);
  operatorListMock.mockResolvedValue(operadores);
  listMineMock.mockResolvedValue(tarjetas);
}

function openOp(overrides: Partial<OutboxOp> = {}): OutboxOp {
  return {
    id: 'pend-open-1',
    type: 'openCard',
    v: 1,
    userId: 'u1',
    status: 'pending',
    attempts: 0,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    payload: {
      id: 'pend-open-1',
      equipoId: 'eq_1',
      operatorId: 'op_1',
      valorInicial: 4300,
      shiftDate: '2026-09-24',
      shiftType: 'DIURNO',
      capturedAt: '2026-09-24T09:30:00.000Z',
    },
    ...overrides,
  } as OutboxOp;
}

function closeOp(cardId: string, overrides: Partial<OutboxOp> = {}): OutboxOp {
  return {
    id: 'pend-close-1',
    type: 'closeCard',
    v: 1,
    userId: 'u1',
    status: 'pending_upload',
    attempts: 0,
    photoId: 'pend-close-1',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    payload: {
      cardId,
      input: {
        closeClientId: 'pend-close-1',
        valorFinal: 130,
        fuelLiters: 20,
        capturedAt: '2026-09-24T16:00:00.000Z',
      },
    },
    ...overrides,
  } as OutboxOp;
}

// --- mapCardToTarjeta --------------------------------------------------------

describe('mapCardToTarjeta', () => {
  const ctx = contextoTurno(new Date(2026, 8, 24, 10, 0)); // DIURNO, 2026-09-24

  it('una tarjeta del shift/tipo del ctx cae en el grupo "actual"', () => {
    const t = mapCardToTarjeta(CARD_ABIERTA_ACTUAL, ctx);
    expect(t.grupo).toBe('actual');
    expect(t.estado).toBe('curso');
    expect(t.arrastrada).toBe(false);
  });

  it('sin `shift` (dato legacy), cae en "anterior" — nunca puede ser "actual"', () => {
    const sinShift: ShiftCardResponse = { ...CARD_ABIERTA_ACTUAL, shift: null };
    expect(mapCardToTarjeta(sinShift, ctx).grupo).toBe('anterior');
  });

  it('sin supervisorName (dato legacy), cae a "Sin identificar"', () => {
    const sinSupervisor: ShiftCardResponse = { ...CARD_ABIERTA_ACTUAL, supervisorName: null };
    expect(mapCardToTarjeta(sinSupervisor, ctx).supervisor).toBe('Sin identificar');
  });
});

// --- aNumero / lineaEstadoCorreo ---------------------------------------------

describe('aNumero', () => {
  it('parsea formato chileno (punto de miles, coma decimal)', () => {
    expect(aNumero('12.487,3')).toBe(12487.3);
  });
  it('vacío devuelve null', () => {
    expect(aNumero('   ')).toBeNull();
  });
});

describe('lineaEstadoCorreo', () => {
  it.each([
    ['SENT', 'Aviso y PDF enviados por correo a la administración'],
    ['PENDING', 'Enviando correo…'],
    ['SKIPPED', 'Aviso enviado en el sistema; el correo no está configurado'],
    ['FAILED', 'Aviso enviado en el sistema; el correo falló'],
    ['ALGO_NUEVO', 'Aviso enviado en el sistema.'],
  ])('%s → %s', (status, esperado) => {
    expect(lineaEstadoCorreo(status)).toBe(esperado);
  });
});

// --- useShiftRegister (integración) -----------------------------------------

describe('useShiftRegister', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date(2026, 8, 24, 10, 0)); // DIURNO, 2026-09-24
  });

  it('abrir() SIEMPRE encola vía enqueueOpenCard (online u offline, un único camino) con un uuid nuevo', async () => {
    mockApis();
    enqueueOpenCardMock.mockResolvedValueOnce(undefined);
    const { Wrapper } = withQueryClient();

    const { result } = renderHook(() => useShiftRegister(), { wrapper: Wrapper });

    await waitFor(() => expect(result.current.disponibles).toHaveLength(1));
    act(() => {
      result.current.setApertura((a) => ({ ...a, equipoId: 'eq_1', operatorId: 'op_1', horometro: '4300' }));
    });
    await waitFor(() => expect(result.current.equipoElegido?.id).toBe('eq_1'));

    act(() => result.current.abrir());

    await waitFor(() => expect(enqueueOpenCardMock).toHaveBeenCalledTimes(1));
    const [userId, payload] = enqueueOpenCardMock.mock.calls[0]!;
    expect(userId).toBe('u1');
    expect(payload.equipoId).toBe('eq_1');
    expect(payload.operatorId).toBe('op_1');
    expect(payload.valorInicial).toBe(4300);
    expect(payload.shiftDate).toBe('2026-09-24');
    expect(payload.shiftType).toBe('DIURNO');
    expect(payload.id).toMatch(/^[0-9a-f-]{36}$/i);
  });

  it('abrir() no hace nada sin operador elegido (guardia silenciosa)', async () => {
    mockApis();
    const { Wrapper } = withQueryClient();
    const { result } = renderHook(() => useShiftRegister(), { wrapper: Wrapper });

    await waitFor(() => expect(result.current.disponibles).toHaveLength(1));
    act(() => result.current.abrir());

    expect(enqueueOpenCardMock).not.toHaveBeenCalled();
  });

  it('cerrar() encola vía enqueueCloseCard (SIN subir la foto en la vista) y resetea el formulario', async () => {
    mockApis({ tarjetas: [CARD_ABIERTA_ACTUAL] });
    mockFotoFile = new File(['x'], 'surtidor.jpg', { type: 'image/jpeg' });
    enqueueCloseCardMock.mockResolvedValueOnce(undefined);
    const { Wrapper } = withQueryClient();

    const { result } = renderHook(() => useShiftRegister(), { wrapper: Wrapper });

    await waitFor(() => expect(result.current.abiertasActual).toHaveLength(1));
    act(() => result.current.abrirCierre('c1'));
    await waitFor(() => expect(result.current.cerrando?.id).toBe('c1'));

    act(() => result.current.setCierre((c) => ({ ...c, final: '130', litros: '20' })));
    await waitFor(() => expect(result.current.finalNum).toBe(130));

    await act(async () => {
      await result.current.cerrar();
    });

    expect(enqueueCloseCardMock).toHaveBeenCalledTimes(1);
    const [userId, cardId, input, file] = enqueueCloseCardMock.mock.calls[0]!;
    expect(userId).toBe('u1');
    expect(cardId).toBe('c1');
    expect(input.valorFinal).toBe(130);
    expect(input.fuelLiters).toBe(20);
    expect(input.closeClientId).toMatch(/^[0-9a-f-]{36}$/i);
    expect('tmpPhotoKey' in input).toBe(false);
    expect(file).toBe(mockFotoFile);
    expect(result.current.cerrandoId).toBeNull();
    expect(resetPhotoMock).toHaveBeenCalled();
  });

  it('cerrar() no hace nada sin foto (guardia silenciosa)', async () => {
    mockApis({ tarjetas: [CARD_ABIERTA_ACTUAL] });
    mockFotoFile = null;
    const { Wrapper } = withQueryClient();

    const { result } = renderHook(() => useShiftRegister(), { wrapper: Wrapper });

    await waitFor(() => expect(result.current.abiertasActual).toHaveLength(1));
    act(() => result.current.abrirCierre('c1'));
    act(() => result.current.setCierre((c) => ({ ...c, final: '130' })));

    await act(async () => {
      await result.current.cerrar();
    });

    expect(enqueueCloseCardMock).not.toHaveBeenCalled();
  });

  it('veTodo es true solo para ADMIN', async () => {
    mockApis();
    mockRole = ROLES.ADMIN;
    const { Wrapper } = withQueryClient();

    const { result } = renderHook(() => useShiftRegister(), { wrapper: Wrapper });

    await waitFor(() => expect(result.current.veTodo).toBe(true));
  });

  describe('proyección offline-first (outbox)', () => {
    it('una apertura pendiente aparece como tarjeta sintética "curso" con sinSincronizar', async () => {
      mockApis();
      mockOps = [openOp()];
      const { Wrapper } = withQueryClient();

      const { result } = renderHook(() => useShiftRegister(), { wrapper: Wrapper });

      await waitFor(() => expect(result.current.abiertasActual).toHaveLength(1));
      const t = result.current.abiertasActual[0]!;
      expect(t.id).toBe('pend-open-1');
      expect(t.estado).toBe('curso');
      expect(t.sinSincronizar).toBe(true);
      expect(t.equipo).toBe('EX-005');
      expect(t.operador).toBe('Patricio Rojas');
      expect(t.inicial).toBe(4300);
    });

    it('un cierre pendiente superpone una tarjeta del SERVIDOR (estado cerrada, sinSincronizar)', async () => {
      mockApis({ tarjetas: [CARD_ABIERTA_ACTUAL] });
      mockOps = [closeOp('c1')];
      const { Wrapper } = withQueryClient();

      const { result } = renderHook(() => useShiftRegister(), { wrapper: Wrapper });

      await waitFor(() => expect(result.current.cerradas).toHaveLength(1));
      const t = result.current.cerradas[0]!;
      expect(t.id).toBe('c1');
      expect(t.final).toBe(130);
      expect(t.litros).toBe(20);
      expect(t.sinSincronizar).toBe(true);
      expect(result.current.abiertasActual).toHaveLength(0);
    });

    it('el servidor gana: una apertura pendiente cuyo id YA tiene tarjeta de servidor se ignora (evita duplicado)', async () => {
      mockApis({ tarjetas: [CARD_ABIERTA_ACTUAL] });
      mockOps = [openOp({ id: 'c1' })];
      const { Wrapper } = withQueryClient();

      const { result } = renderHook(() => useShiftRegister(), { wrapper: Wrapper });

      await waitFor(() => expect(result.current.abiertasActual).toHaveLength(1));
      expect(result.current.abiertasActual[0]!.sinSincronizar).toBeUndefined();
    });

    it('disponibles excluye el equipo de una apertura pendiente propia', async () => {
      mockApis();
      mockOps = [openOp()]; // equipoId: eq_1, el único equipo
      const { Wrapper } = withQueryClient();

      const { result } = renderHook(() => useShiftRegister(), { wrapper: Wrapper });

      await waitFor(() => expect(result.current.abiertasActual).toHaveLength(1));
      expect(result.current.disponibles).toHaveLength(0);
    });

    it('disponibles LIBERA el equipo de una tarjeta con un cierre pendiente (FIFO garantiza el orden)', async () => {
      const ocupado = { ...EQUIPO, id: 'eq_1', openShift: { supervisorName: 'Ana Soto' } };
      mockApis({ equipos: [ocupado], tarjetas: [CARD_ABIERTA_ACTUAL] });
      mockOps = [closeOp('c1')];
      const { Wrapper } = withQueryClient();

      const { result } = renderHook(() => useShiftRegister(), { wrapper: Wrapper });

      await waitFor(() => expect(result.current.cerradas).toHaveLength(1));
      expect(result.current.disponibles.map((e) => e.id)).toEqual(['eq_1']);
    });
  });

  describe('reporte de salida (conectado al outbox)', () => {
    it('sin nada, es "sin-enviar"', async () => {
      mockApis({ tarjetas: [CARD_ABIERTA_ACTUAL] });
      const { Wrapper } = withQueryClient();

      const { result } = renderHook(() => useShiftRegister(), { wrapper: Wrapper });

      await waitFor(() => expect(result.current.enCurso).toHaveLength(1));
      expect(result.current.reporteEstado).toBe('sin-enviar');
    });

    it('enviarReporte() encola vía enqueueExitReport con los ids de enCurso', async () => {
      mockApis({ tarjetas: [CARD_ABIERTA_ACTUAL] });
      enqueueExitReportMock.mockResolvedValueOnce(undefined);
      const { Wrapper } = withQueryClient();

      const { result } = renderHook(() => useShiftRegister(), { wrapper: Wrapper });
      await waitFor(() => expect(result.current.enCurso).toHaveLength(1));

      act(() => result.current.enviarReporte());

      await waitFor(() => expect(enqueueExitReportMock).toHaveBeenCalledTimes(1));
      const [userId, payload] = enqueueExitReportMock.mock.calls[0]!;
      expect(userId).toBe('u1');
      expect(payload.cardIds).toEqual(['c1']);
      expect(payload.shiftDate).toBe('2026-09-24');
      expect(payload.shiftType).toBe('DIURNO');
      expect(payload.id).toMatch(/^[0-9a-f-]{36}$/i);
    });

    /**
     * Doble-toque: sin el guard, dos toques
     * antes de que `liveQuery` alcance a reflejar el primer encolado
     * generaban DOS operaciones con uuids distintos — dos PDF, dos rondas
     * de correo.
     */
    it('un segundo toque mientras el primero sigue en vuelo (isEnviandoReporte) NO duplica la operación', async () => {
      mockApis({ tarjetas: [CARD_ABIERTA_ACTUAL] });
      let resolveEnqueue: () => void = () => {};
      enqueueExitReportMock.mockImplementationOnce(
        () =>
          new Promise<void>((resolve) => {
            resolveEnqueue = resolve;
          }),
      );
      const { Wrapper } = withQueryClient();

      const { result } = renderHook(() => useShiftRegister(), { wrapper: Wrapper });
      await waitFor(() => expect(result.current.enCurso).toHaveLength(1));

      // Primer toque: queda "en vuelo" (el mock todavía no resuelve).
      act(() => result.current.enviarReporte());
      await waitFor(() => expect(result.current.isEnviandoReporte).toBe(true));

      // Segundo toque MIENTRAS el primero sigue en vuelo — el guard debe
      // cortarlo antes de llamar a `enqueueExitReport` de nuevo (si no,
      // el mock por defecto de la segunda llamada no devuelve una promesa
      // y el `.catch()` de adentro explota).
      act(() => result.current.enviarReporte());
      expect(enqueueExitReportMock).toHaveBeenCalledTimes(1);

      await act(async () => {
        resolveEnqueue();
        await Promise.resolve();
      });
      await waitFor(() => expect(result.current.isEnviandoReporte).toBe(false));
    });

    it('con una operación sendExitReport pendiente del turno actual, es "en-cola"', async () => {
      mockApis({ tarjetas: [CARD_ABIERTA_ACTUAL] });
      mockOps = [
        {
          id: 'rep-1',
          type: 'sendExitReport',
          v: 1,
          userId: 'u1',
          status: 'pending',
          attempts: 0,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          payload: {
            id: 'rep-1',
            shiftDate: '2026-09-24',
            shiftType: 'DIURNO',
            cardIds: ['c1'],
            requestedAt: '2026-09-24T20:00:00.000Z',
          },
        } as OutboxOp,
      ];
      const { Wrapper } = withQueryClient();

      const { result } = renderHook(() => useShiftRegister(), { wrapper: Wrapper });

      await waitFor(() => expect(result.current.reporteEstado).toBe('en-cola'));

      // Ya hay una operación de reporte para ESTE turno — `enviarReporte()`
      // no debe encolar una segunda (mismo bug del doble-toque, pero vía la
      // proyección del outbox en vez del estado local).
      act(() => result.current.enviarReporte());
      expect(enqueueExitReportMock).not.toHaveBeenCalled();
    });

    it('con esa operación en needs_attention, es "requiere-atencion" y expone el error', async () => {
      mockApis({ tarjetas: [CARD_ABIERTA_ACTUAL] });
      mockOps = [
        {
          id: 'rep-1',
          type: 'sendExitReport',
          v: 1,
          userId: 'u1',
          status: 'needs_attention',
          attempts: 1,
          lastError: { message: 'SHIFT_NOT_FOUND', code: 'SHIFT_NOT_FOUND' },
          createdAt: Date.now(),
          updatedAt: Date.now(),
          payload: {
            id: 'rep-1',
            shiftDate: '2026-09-24',
            shiftType: 'DIURNO',
            cardIds: ['c1'],
            requestedAt: '2026-09-24T20:00:00.000Z',
          },
        } as OutboxOp,
      ];
      const { Wrapper } = withQueryClient();

      const { result } = renderHook(() => useShiftRegister(), { wrapper: Wrapper });

      await waitFor(() => expect(result.current.reporteEstado).toBe('requiere-atencion'));
      expect(result.current.reporteError?.message).toBe('SHIFT_NOT_FOUND');
    });

    it('con `shift.exitReports` del servidor para el turno actual, es "enviado" y no puede reenviar si el conteo coincide', async () => {
      const conReporte: ShiftCardResponse = {
        ...CARD_ABIERTA_ACTUAL,
        shift: {
          ...CARD_ABIERTA_ACTUAL.shift!,
          exitReports: [{ id: 'rep-1', requestedAt: '2026-09-24T08:00:00.000Z', cardCount: 1, emailStatus: 'SENT' }],
        },
      };
      mockApis({ tarjetas: [conReporte] });
      const { Wrapper } = withQueryClient();

      const { result } = renderHook(() => useShiftRegister(), { wrapper: Wrapper });

      await waitFor(() => expect(result.current.reporteEstado).toBe('enviado'));
      expect(result.current.reporteUltimo?.id).toBe('rep-1');
      expect(result.current.reportePuedeReenviar).toBe(false);
      expect(result.current.reporteUrl('rep-1')).toBe('/api/shift-reports/rep-1/file');
    });

    it('"enviado" pero con MÁS equipos en curso que `cardCount` del último reporte: puede reenviar', async () => {
      const otraTarjeta: ShiftCardResponse = { ...CARD_ABIERTA_ACTUAL, id: 'c2', equipoId: 'eq_2' };
      const conReporte: ShiftCardResponse = {
        ...CARD_ABIERTA_ACTUAL,
        shift: {
          ...CARD_ABIERTA_ACTUAL.shift!,
          exitReports: [{ id: 'rep-1', requestedAt: '2026-09-24T08:00:00.000Z', cardCount: 1, emailStatus: 'SENT' }],
        },
      };
      const otraConMismoShift: ShiftCardResponse = { ...otraTarjeta, shift: conReporte.shift };
      mockApis({ tarjetas: [conReporte, otraConMismoShift] });
      const { Wrapper } = withQueryClient();

      const { result } = renderHook(() => useShiftRegister(), { wrapper: Wrapper });

      await waitFor(() => expect(result.current.enCurso).toHaveLength(2));
      expect(result.current.reportePuedeReenviar).toBe(true);
    });
  });
});
