import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';

import { SupervisorTemporalView } from './SupervisorTemporalView';
import { DomainError } from '../lib/api-error';
import type { OutboxOp } from '../offline/db';
import type { ShiftCardResponse } from '../types/shift';

// La cola es EN VIVO (como `useOutboxOps` sobre Dexie): un cambio re-renderiza la vista.
const { equipmentListMock, enviando, escritorio, listMineMock, misInformesMock, mutateAsyncMock, opsMock } = vi.hoisted(() => {
  const listeners = new Set<() => void>();
  const opsMock = {
    current: [] as unknown[],
    set(next: unknown[]) {
      opsMock.current = next;
      listeners.forEach((l) => l());
    },
    subscribe(l: () => void) {
      listeners.add(l);
      return () => listeners.delete(l);
    },
  };
  return {
    equipmentListMock: vi.fn(),
    enviando: { value: false },
    escritorio: { value: false },
    listMineMock: vi.fn(),
    misInformesMock: vi.fn(() => ({ data: [], isPending: false, isError: false, error: null })),
    mutateAsyncMock: vi.fn(),
    opsMock,
  };
});

vi.mock('../api/EquipmentAPI', () => ({ EquipmentAPI: { list: equipmentListMock } }));
vi.mock('../api/ShiftCardAPI', () => ({ ShiftCardAPI: { listMine: listMineMock } }));
vi.mock('../offline/outbox', () => ({ enqueueOpenCard: vi.fn(), enqueueCloseCard: vi.fn() }));
vi.mock('../offline/useOutboxOps', async () => {
  const { useSyncExternalStore } = await import('react');
  return {
    useOutboxOps: () =>
      useSyncExternalStore(
        (l) => opsMock.subscribe(l),
        () => opsMock.current,
      ),
  };
});
vi.mock('../hooks/useInformesTemporales', () => ({
  useCrearInformeTemporal: () => ({ mutateAsync: mutateAsyncMock, isPending: enviando.value }),
  useMisInformesTemporales: () => misInformesMock(),
}));
// Teléfono o escritorio: el cierre va en una hoja en los dos.
vi.mock('../hooks/useMediaQuery', () => ({
  DESKTOP_QUERY: '(min-width: 1024px)',
  useMediaQuery: () => escritorio.value,
}));
vi.mock('../api/OcrAPI', () => ({ fuelReadingOcr: vi.fn() }));
vi.mock('../hooks/useOperators', () => ({ useOperators: () => ({ data: [], isPending: false }) }));
vi.mock('../hooks/useCurrentUser', () => ({
  useCurrentUser: () => ({
    user: { id: 'tmp_1', name: 'Pedro Soto', email: 'p@smi.local' },
    role: 'SUPERVISOR_TEMPORAL',
  }),
}));
vi.mock('@heroui/react', async (original) => ({
  ...(await original<typeof import('@heroui/react')>()),
  toast: { danger: vi.fn(), success: vi.fn() },
}));

const CARGADOR = {
  id: 'eq_1',
  internalCode: 'CA-003',
  type: 'Cargador',
  brand: 'SEM',
  model: '656F',
  status: 'OPERATIONAL',
  equipmentClass: 'HEAVY',
  currentHourmeter: 1200,
  currentMileage: null,
  openShift: { supervisorName: 'Pedro Soto' },
};

function tarjeta(id = 'card_1'): ShiftCardResponse {
  return {
    id,
    equipoId: 'eq_1',
    equipo: { internalCode: 'CA-003', type: 'Cargador', controlUnit: 'HOURS', equipmentClass: 'HEAVY' },
    operatorId: 'op_1',
    operatorName: 'Juan Rojas',
    supervisorId: 'tmp_1',
    supervisorName: 'Pedro Soto',
    shift: null,
    valorInicial: 1200,
    valorFinal: null,
    horasMaquina: null,
    fuelLiters: null,
    adBlue: false,
    adBlueLiters: null,
    pumpPhotoUrl: null,
    observaciones: null,
    belowPreviousReading: false,
    fecha: '2026-11-24T11:00:00.000Z',
    fechaSalida: null,
    createdAt: '2026-11-24T11:00:00.000Z',
    closedAt: null,
  };
}

function renderView() {
  return render(
    <MemoryRouter>
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <SupervisorTemporalView />
      </QueryClientProvider>
    </MemoryRouter>,
  );
}

const botonCerrar = () => screen.getByRole('button', { name: /Cerrar y generar informe/ });

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  listMineMock.mockReset();
  opsMock.current = [];
  escritorio.value = false;
  enviando.value = false;
});

/** Como `submitWrite`: encola el informe ANTES de esperar al servidor; el 409 lo
 * descarta de la cola y rechaza. */
function enviarCon409(mensaje: string) {
  mutateAsyncMock.mockImplementationOnce(async ({ informe }: { informe: { id: string; cierres: unknown[] } }) => {
    const op = {
      id: 'op_inf',
      type: 'httpWrite',
      endpoint: 'informeTemporal.create',
      status: 'pending',
      params: {},
      body: informe,
    };
    opsMock.set([...opsMock.current, op]);
    await new Promise((r) => setTimeout(r, 30));
    opsMock.set(opsMock.current.filter((o) => o !== op));
    throw new DomainError(mensaje, { code: 'INFORME_TARJETAS_DESCUADRADAS', status: 409 });
  });
}

async function abrirYLlenar() {
  // Con la tarjeta ya cargada, el botón está habilitado.
  await screen.findByText('CA-003');
  fireEvent.click(await screen.findByRole('button', { name: /Cerrar y generar informe/ }));
  const fila = await screen.findByRole('group', { name: /CA-003/ });
  fireEvent.change(within(fila).getByLabelText(/Horómetro final/), { target: { value: '1210' } });
  fireEvent.change(screen.getByLabelText(/Actividad realizada 1/), { target: { value: 'Limpieza de cancha' } });
  fireEvent.click(screen.getByRole('button', { name: /Enviar informe/ }));
}

describe('SupervisorTemporalView', () => {
  it('deshabilita «Cerrar y generar informe» sin tarjetas abiertas', async () => {
    equipmentListMock.mockResolvedValue([{ ...CARGADOR, openShift: null }]);
    listMineMock.mockResolvedValue([]);
    renderView();
    await waitFor(() => expect(listMineMock).toHaveBeenCalled());
    expect(await screen.findByText(/No tienes equipos abiertos/)).toBeTruthy();
    expect(botonCerrar().hasAttribute('disabled')).toBe(true);
    expect(screen.getByRole('button', { name: /Abrir equipo/ })).toBeTruthy();
  });

  it('el historial es un botón debajo del cierre que lo abre en una hoja, no una lista en línea', async () => {
    equipmentListMock.mockResolvedValue([]);
    listMineMock.mockResolvedValue([]);
    renderView();
    const boton = await screen.findByRole('button', { name: /Ver historial de reportes/ });
    expect(botonCerrar().compareDocumentPosition(boton) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.queryByText('Historial de reportes')).toBeNull();
    expect(screen.queryByText('Aún no has enviado reportes.')).toBeNull();

    fireEvent.click(boton);
    const hoja = screen.getByRole('dialog', { name: 'Historial de reportes' });
    expect(within(hoja).getByText('Aún no has enviado reportes.')).toBeTruthy();
  });

  it.each([
    ['teléfono', false],
    ['escritorio', true],
  ])('en %s «Cerrar y generar informe» abre el formulario en una hoja', async (_, enEscritorio) => {
    escritorio.value = enEscritorio;
    equipmentListMock.mockResolvedValue([CARGADOR]);
    listMineMock.mockResolvedValue([tarjeta()]);
    renderView();
    await screen.findByText('CA-003');
    expect(screen.queryByRole('button', { name: /Enviar informe/ })).toBeNull();

    fireEvent.click(botonCerrar());
    const hoja = screen.getByRole('dialog', { name: 'Informe de actividad' });
    expect(within(hoja).getByRole('group', { name: /CA-003/ })).toBeTruthy();
    expect(within(hoja).getByRole('button', { name: /Enviar informe/ })).toBeTruthy();
  });

  describe('cerrar la hoja de cierre', () => {
    async function abrirCierre() {
      equipmentListMock.mockResolvedValue([CARGADOR]);
      listMineMock.mockResolvedValue([tarjeta()]);
      renderView();
      await screen.findByText('CA-003');
      fireEvent.click(botonCerrar());
      return screen.getByRole('dialog', { name: 'Informe de actividad' });
    }
    const xDe = (hoja: HTMLElement) => within(hoja).getByRole('button', { name: 'Cerrar' });

    it('tocar el fondo no la cierra: el fondo ni siquiera es un botón', async () => {
      const hoja = await abrirCierre();
      fireEvent.change(within(hoja).getByLabelText(/Actividad realizada 1/), { target: { value: 'Limpieza' } });
      // El único «Cerrar» es la X de la hoja.
      expect(screen.getAllByRole('button', { name: 'Cerrar' })).toEqual([xDe(hoja)]);
      fireEvent.click(hoja.previousElementSibling!);
      expect(screen.getByRole('dialog', { name: 'Informe de actividad' })).toBeTruthy();
      expect((screen.getByLabelText(/Actividad realizada 1/) as HTMLInputElement).value).toBe('Limpieza');
    });

    it('sin nada escrito, la X la cierra directo', async () => {
      const hoja = await abrirCierre();
      fireEvent.click(xDe(hoja));
      expect(screen.queryByRole('dialog', { name: 'Informe de actividad' })).toBeNull();
      expect(screen.queryByRole('alertdialog')).toBeNull();
    });

    it('con algo escrito, la X pregunta: «Seguir llenando» conserva y «Descartar» cierra y al reabrir empieza vacío', async () => {
      const hoja = await abrirCierre();
      fireEvent.change(within(hoja).getByLabelText(/Actividad realizada 1/), { target: { value: 'Limpieza' } });
      const fila = within(hoja).getByRole('group', { name: /CA-003/ });
      fireEvent.change(within(fila).getByLabelText(/Horómetro final/), { target: { value: '1210' } });

      fireEvent.click(xDe(hoja));
      let confirmar = await screen.findByRole('alertdialog');
      expect(within(confirmar).getByText('¿Descartar el informe?')).toBeTruthy();
      expect(within(confirmar).getByText('Se perderá lo que llenaste.')).toBeTruthy();
      fireEvent.click(within(confirmar).getByRole('button', { name: 'Seguir llenando' }));
      await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
      expect(screen.getByRole('dialog', { name: 'Informe de actividad' })).toBeTruthy();
      expect((screen.getByLabelText(/Actividad realizada 1/) as HTMLInputElement).value).toBe('Limpieza');
      expect((within(fila).getByLabelText(/Horómetro final/) as HTMLInputElement).value).toBe('1210');

      fireEvent.click(xDe(screen.getByRole('dialog', { name: 'Informe de actividad' })));
      confirmar = await screen.findByRole('alertdialog');
      fireEvent.click(within(confirmar).getByRole('button', { name: 'Descartar' }));
      await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Informe de actividad' })).toBeNull());
      await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());

      fireEvent.click(botonCerrar());
      const nueva = screen.getByRole('dialog', { name: 'Informe de actividad' });
      expect((within(nueva).getByLabelText(/Actividad realizada 1/) as HTMLInputElement).value).toBe('');
      const filaNueva = within(nueva).getByRole('group', { name: /CA-003/ });
      expect((within(filaNueva).getByLabelText(/Horómetro final/) as HTMLInputElement).value).toBe('');
      // Limpio de nuevo: la X vuelve a cerrar sin preguntar.
      fireEvent.click(xDe(nueva));
      expect(screen.queryByRole('dialog', { name: 'Informe de actividad' })).toBeNull();
      expect(screen.queryByRole('alertdialog')).toBeNull();
    });

    it('mientras se envía no se puede cerrar', async () => {
      enviando.value = true;
      const hoja = await abrirCierre();
      expect(within(hoja).getByRole('button', { name: /Enviando informe/ })).toBeTruthy();
      const x = xDe(hoja);
      expect(x.hasAttribute('disabled')).toBe(true);
      fireEvent.click(x);
      expect(screen.getByRole('dialog', { name: 'Informe de actividad' })).toBeTruthy();
      expect(screen.queryByRole('alertdialog')).toBeNull();
    });

    it('las otras hojas siguen cerrándose al tocar el fondo (historial)', async () => {
      equipmentListMock.mockResolvedValue([]);
      listMineMock.mockResolvedValue([]);
      renderView();
      fireEvent.click(await screen.findByRole('button', { name: /Ver historial de reportes/ }));
      const hoja = screen.getByRole('dialog', { name: 'Historial de reportes' });
      const fondo = screen.getAllByRole('button', { name: 'Cerrar' }).find((b) => !hoja.contains(b))!;
      fireEvent.click(fondo);
      expect(screen.queryByRole('dialog', { name: 'Historial de reportes' })).toBeNull();
    });
  });

  it('lista las tarjetas abiertas con código y nombre, y habilita el cierre', async () => {
    equipmentListMock.mockResolvedValue([CARGADOR]);
    listMineMock.mockResolvedValue([tarjeta()]);
    renderView();
    expect(await screen.findByText('CA-003')).toBeTruthy();
    expect(screen.getByText(/Cargador SEM 656F/)).toBeTruthy();
    expect(botonCerrar().hasAttribute('disabled')).toBe(false);
  });

  it('su camioneta y los livianos ajenos («Mi camioneta») no se listan ni van al informe', async () => {
    equipmentListMock.mockResolvedValue([CARGADOR]);
    const camioneta = {
      ...tarjeta('card_cam'),
      equipoId: 'eq_l1',
      equipo: { internalCode: 'CM-001', type: 'Camioneta', controlUnit: 'KM', equipmentClass: 'LIGHT' },
      operatorId: null,
      operatorName: '',
      temporal: false,
    } satisfies ShiftCardResponse;
    listMineMock.mockResolvedValue([
      { ...tarjeta(), temporal: true },
      camioneta,
      { ...camioneta, id: 'card_ajena', supervisorId: 'sup_2', supervisorName: 'Marta Díaz' },
    ]);
    renderView();
    expect(await screen.findByText('CA-003')).toBeTruthy();
    expect(screen.queryByText('CM-001')).toBeNull();
    expect(screen.getByText('1 equipo abierto')).toBeTruthy();
  });

  it('una apertura pendiente de «Mi camioneta» no se lista; una de «Mis equipos» sí', async () => {
    equipmentListMock.mockResolvedValue([CARGADOR]);
    listMineMock.mockResolvedValue([]);
    const apertura = (id: string, extra: Record<string, unknown>) => ({
      id,
      type: 'openCard',
      userId: 'tmp_1',
      status: 'pending',
      payload: {
        id,
        equipoId: 'eq_1',
        operatorId: 'op_1',
        valorInicial: 1200,
        shiftDate: '2026-11-24',
        shiftType: 'DIURNO',
        capturedAt: '2026-11-24T11:00:00.000Z',
        ...extra,
      },
    });
    opsMock.current = [
      apertura('op_equipo', {}),
      apertura('op_cam', { camioneta: true }),
    ] as unknown as OutboxOp[];
    renderView();
    expect(await screen.findByText('CA-003')).toBeTruthy();
    expect(screen.getAllByText('CA-003')).toHaveLength(1);
    expect(screen.getByText('1 equipo abierto')).toBeTruthy();
  });

  it('una tarjeta que ya va en un informe pendiente de envío no se lista', async () => {
    equipmentListMock.mockResolvedValue([CARGADOR]);
    listMineMock.mockResolvedValue([tarjeta()]);
    opsMock.current = [
      {
        id: 'op_inf',
        type: 'httpWrite',
        endpoint: 'informeTemporal.create',
        status: 'pending',
        body: { cierres: [{ cardId: 'card_1' }] },
        params: {},
      },
    ] as unknown as OutboxOp[];
    renderView();
    expect(await screen.findByText(/pendiente de envío/)).toBeTruthy();
    expect(screen.queryByText('CA-003')).toBeNull();
    expect(botonCerrar().hasAttribute('disabled')).toBe(true);
  });

  it('el formulario no se oculta con su propio envío: un 409 deja los datos, el mensaje y los mismos ids', async () => {
    escritorio.value = true;
    equipmentListMock.mockResolvedValue([CARGADOR]);
    listMineMock.mockResolvedValue([tarjeta()]);
    renderView();
    enviarCon409('Falta CA-009 en el informe.');
    await abrirYLlenar();

    expect(await screen.findByText('Falta CA-009 en el informe.')).toBeTruthy();
    // Sigue dentro de la hoja, con la misma tarjeta aunque su informe estuvo en la cola.
    const hoja = screen.getByRole('dialog', { name: 'Informe de actividad' });
    expect(within(hoja).getByText('Falta CA-009 en el informe.')).toBeTruthy();
    expect((screen.getByLabelText(/Actividad realizada 1/) as HTMLInputElement).value).toBe('Limpieza de cancha');
    const fila = screen.getByRole('group', { name: /CA-003/ });
    expect((within(fila).getByLabelText(/Horómetro final/) as HTMLInputElement).value).toBe('1210');

    mutateAsyncMock.mockResolvedValueOnce({ status: 'queued', opId: 'op2' });
    fireEvent.click(screen.getByRole('button', { name: /Enviar informe/ }));
    await waitFor(() => expect(mutateAsyncMock).toHaveBeenCalledTimes(2));
    const [primero, segundo] = mutateAsyncMock.mock.calls.map((c) => c[0].informe);
    expect(segundo.id).toBe(primero.id);
    expect(segundo.cierres[0].closeClientId).toBe(primero.cierres[0].closeClientId);
    // En la cola: la hoja se cierra.
    await waitFor(() => expect(screen.queryByRole('button', { name: /Enviar informe/ })).toBeNull());
  });

  it('si tras el 409 no quedan tarjetas abiertas, el mensaje sigue a la vista', async () => {
    equipmentListMock.mockResolvedValue([CARGADOR]);
    listMineMock.mockResolvedValueOnce([tarjeta()]).mockResolvedValue([]);
    renderView();
    enviarCon409('Las tarjetas ya se cerraron.');
    await abrirYLlenar();

    expect(await screen.findByText('Las tarjetas ya se cerraron.')).toBeTruthy();
    expect(await screen.findByText(/No te quedan equipos abiertos/)).toBeTruthy();
    expect(screen.getByText('Las tarjetas ya se cerraron.')).toBeTruthy();
    expect(screen.getByRole('button', { name: /Enviar informe/ }).hasAttribute('disabled')).toBe(true);
  });
});
