import 'fake-indexeddb/auto';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('@heroui/react', () => ({ toast: { danger: vi.fn(), success: vi.fn(), info: vi.fn(), warning: vi.fn() } }));
vi.mock('./useCurrentUser', () => ({ useCurrentUser: () => ({ user: { id: 'u1' } }) }));
// El replay nunca habla con un servidor real: el sender y la subida son dobles.
const { sendWriteMock, uploadFileMock } = vi.hoisted(() => ({ sendWriteMock: vi.fn(), uploadFileMock: vi.fn() }));
vi.mock('../api/WriteAPI', () => ({ sendWrite: sendWriteMock }));
vi.mock('../api/UploadsAPI', () => ({ uploadFile: uploadFileMock }));

import { toast } from '@heroui/react';
import { useCrearInformeTemporal } from './useInformesTemporales';
import { DomainError } from '../lib/api-error';
import { db, type HttpWriteOp, type OutboxOp } from '../offline/db';
import { resetReplayEngineForTests, setCurrentUser } from '../offline/replay';
import { ENDPOINTS } from '../offline/endpoints';
import { InformeTemporalSchema, type CreateInformeTemporalInput } from '../types/informe-temporal';

const INFORME_ID = '7c1d2e3f-4a5b-4c6d-8e7f-9a0b1c2d3e4f';

const informeRespuesta = {
  id: INFORME_ID,
  numero: 12,
  fecha: '2026-11-24',
  turno: 'DIURNO',
  actividad1: 'Limpieza de cancha',
  actividad2: null,
  personal: [{ actividad: 1, operatorId: 'op1', nombre: 'Juan Rojas' }],
  observaciones: null,
  supervisorResponsable1: 'Pedro Soto',
  supervisorResponsable2: null,
  supervisorId: 'u1',
  supervisorNombre: 'Ana Temporal',
  inicio: '2026-11-24T08:00:00.000Z',
  fin: '2026-11-24T18:00:00.000Z',
  createdAt: '2026-11-24T18:00:01.000Z',
  updatedAt: '2026-11-24T18:00:01.000Z',
  tarjetas: [
    {
      id: 'c1',
      equipo: { id: 'e1', internalCode: 'EX-005', name: 'Excavadora Komatsu PC200' },
      operador: 'Juan Rojas',
      valorInicial: 1200,
      valorFinal: 1210,
      fuelLiters: 40,
      adBlueLiters: null,
      pumpPhotoUrl: 'https://storage.example/firmada.jpg',
      fecha: '2026-11-24T08:00:00.000Z',
      fechaSalida: '2026-11-24T18:00:00.000Z',
    },
  ],
};

function informe(): CreateInformeTemporalInput {
  return {
    id: INFORME_ID,
    fecha: '2026-11-24',
    turno: 'DIURNO',
    actividad1: 'Limpieza de cancha',
    personal: [{ actividad: 1, operatorId: 'op1', nombre: 'Juan Rojas' }],
    supervisorResponsable1: 'Pedro Soto',
    cierres: [
      {
        cardId: 'c1',
        closeClientId: '0b0e2c55-4a5c-4d3e-9b8a-2f6d7e1c9a01',
        valorFinal: 1210,
        fuelLiters: 40,
        capturedAt: '2026-11-24T18:00:00.000Z',
      },
      {
        cardId: 'c2',
        closeClientId: '0b0e2c55-4a5c-4d3e-9b8a-2f6d7e1c9a02',
        valorFinal: 800,
        fuelLiters: 0,
        capturedAt: '2026-11-24T18:00:00.000Z',
      },
      {
        cardId: 'c3',
        closeClientId: '0b0e2c55-4a5c-4d3e-9b8a-2f6d7e1c9a03',
        valorFinal: 50,
        fuelLiters: 10,
        capturedAt: '2026-11-24T18:00:00.000Z',
      },
    ],
  };
}

/** Apertura de la tarjeta `id` que sigue en la cola (sin sincronizar). */
function aperturaPendiente(id: string, seq: number): OutboxOp {
  return {
    id,
    type: 'openCard',
    v: 1,
    userId: 'u1',
    status: 'pending',
    attempts: 0,
    seq,
    createdAt: seq,
    updatedAt: seq,
    entityKey: `shift-card:${id}`,
    payload: { id, equipoId: 'e1', valorInicial: 100, shiftDate: '2026-11-24', shiftType: 'DIURNO', capturedAt: 't' },
  };
}

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

async function opsDelInforme(): Promise<HttpWriteOp[]> {
  const ops = await db.outbox.toArray();
  return ops.filter((op): op is HttpWriteOp => op.type === 'httpWrite' && op.endpoint === 'informeTemporal.create');
}

/** `navigator.onLine` del test: sin red `submitWrite` devuelve `queued` sin esperar. */
let enLinea = false;

beforeEach(async () => {
  enLinea = false;
  vi.spyOn(navigator, 'onLine', 'get').mockImplementation(() => enLinea);
  await db.outbox.clear();
  await db.blobs.clear();
});

afterEach(() => {
  setCurrentUser(null);
  resetReplayEngineForTests();
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

describe('InformeTemporalSchema', () => {
  it('parsea el informe tal como lo devuelve el backend', () => {
    const parsed = InformeTemporalSchema.parse(informeRespuesta);
    expect(parsed.fecha).toBe('2026-11-24');
    expect(parsed.tarjetas[0].equipo.name).toBe('Excavadora Komatsu PC200');
    expect(parsed.tarjetas[0].pumpPhotoUrl).toBe('https://storage.example/firmada.jpg');
  });

  it('acepta una tarjeta cerrada sin foto (pumpPhotoUrl null)', () => {
    const sinFoto = {
      ...informeRespuesta,
      tarjetas: [{ ...informeRespuesta.tarjetas[0], pumpPhotoUrl: null, fuelLiters: 0 }],
    };
    expect(InformeTemporalSchema.safeParse(sinFoto).success).toBe(true);
  });
});

describe('endpoint informeTemporal.create', () => {
  it('declara entidad, padres (las tarjetas que cierra) e invalidaciones', () => {
    const def = ENDPOINTS['informeTemporal.create'];
    const body = informe() as unknown as Parameters<typeof def.label>[1];
    expect(def.method).toBe('POST');
    expect(def.path({})).toBe('/api/informes-temporales');
    expect(def.carriesFiles).toBe(true);
    expect(def.creates).toBe(true);
    expect(def.entity?.({}, body)).toBe(`informe-temporal:${INFORME_ID}`);
    expect(def.parents?.({}, body)).toEqual(['shift-card:c1', 'shift-card:c2', 'shift-card:c3']);
    expect(def.invalidate).toEqual(['shiftCards', 'equipment', 'informesTemporales']);
    expect(def.label({}, body)).toContain('Informe supervisor temporal');
  });
});

describe('useCrearInformeTemporal', () => {
  it('encola UN httpWrite con el id del llamador, la foto de cada cierre que la trae y detrás de las aperturas pendientes', async () => {
    await db.outbox.bulkPut([aperturaPendiente('c1', 1), aperturaPendiente('c3', 2)]);
    const foto1 = new File(['a'], 'surtidor-1.jpg', { type: 'image/jpeg' });
    const foto3 = new File(['b'], 'surtidor-3.jpg', { type: 'image/jpeg' });

    const { result } = renderHook(useCrearInformeTemporal, { wrapper });
    result.current.mutate({ informe: informe(), fotos: { c1: foto1, c3: foto3 } });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toMatchObject({ status: 'queued' });
    const ops = await opsDelInforme();
    expect(ops).toHaveLength(1);
    const [op] = ops;
    expect(op.body).toMatchObject({ id: INFORME_ID });
    expect((op.body.cierres as { closeClientId: string }[]).map((c) => c.closeClientId)).toEqual(
      informe().cierres.map((c) => c.closeClientId),
    );
    expect(op.files?.map((f) => f.field)).toEqual(['cierres.0.tmpPhotoKey', 'cierres.2.tmpPhotoKey']);
    expect(op.status).toBe('pending_upload');
    expect(op.entityKey).toBe(`informe-temporal:${INFORME_ID}`);
    expect([...(op.dependsOn ?? [])].sort()).toEqual(['c1', 'c3']);
    expect(await db.blobs.count()).toBe(2);
  });

  it('sin fotos ni aperturas pendientes: queda pending, sin files ni dependsOn', async () => {
    const { result } = renderHook(useCrearInformeTemporal, { wrapper });
    result.current.mutate({ informe: informe() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const [op] = await opsDelInforme();
    expect(op.status).toBe('pending');
    expect(op.files).toBeUndefined();
    expect(op.dependsOn).toBeUndefined();
    // Aviso propio del informe en vez del común de la cola.
    expect(toast.success).toHaveBeenCalledWith('Se enviará al recuperar señal');
  });

  it('no manda turno dentro de los cierres (el backend responde 400)', async () => {
    const conTurno = informe();
    const cierres = conTurno.cierres.map((c) => ({ ...c, shiftDate: '2026-11-24', shiftType: 'DIURNO' }));
    const { result } = renderHook(useCrearInformeTemporal, { wrapper });
    result.current.mutate({ informe: { ...conTurno, cierres } as CreateInformeTemporalInput });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const [op] = await opsDelInforme();
    for (const cierre of op.body.cierres as Record<string, unknown>[]) {
      expect(cierre).not.toHaveProperty('shiftDate');
      expect(cierre).not.toHaveProperty('shiftType');
    }
  });

  it('con señal espera al servidor: un 409 rechaza la mutación con el DomainError y su code', async () => {
    enLinea = true;
    setCurrentUser('u1');
    sendWriteMock.mockRejectedValueOnce(
      new DomainError('Las tarjetas del informe no coinciden con las abiertas.', {
        code: 'INFORME_TARJETAS_DESCUADRADAS',
        status: 409,
      }),
    );

    const { result } = renderHook(useCrearInformeTemporal, { wrapper });
    result.current.mutate({ informe: informe() });
    await waitFor(() => expect(result.current.isError).toBe(true), { timeout: 5000 });

    expect(sendWriteMock).toHaveBeenCalledTimes(1);
    expect(result.current.error).toBeInstanceOf(DomainError);
    expect(result.current.error).toMatchObject({ code: 'INFORME_TARJETAS_DESCUADRADAS', status: 409 });
    // El rechazo de negocio no queda esperando en la hoja de sincronización.
    expect(await opsDelInforme()).toHaveLength(0);
  });
});
