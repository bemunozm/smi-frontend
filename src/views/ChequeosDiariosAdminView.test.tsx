import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, cleanup, screen, within, fireEvent } from '@testing-library/react';

import type { DailyChecklistDetail, DailyChecklistSummary } from '../types/daily-checklist';
import { toDateOnly } from '../lib/turno';

const { periodoHook, detalleHook, escritorio, query } = vi.hoisted(() => ({
  periodoHook: vi.fn(),
  detalleHook: vi.fn(),
  escritorio: { value: true },
  query: { value: '' },
}));

vi.mock('react-router-dom', () => ({
  useSearchParams: () => [new URLSearchParams(query.value)],
}));

vi.mock('../hooks/useDailyChecklists', () => ({
  useChecklistsDelPeriodo: (from: string, to: string) => periodoHook(from, to),
  useChecklistDetalle: (id: string | null) => detalleHook(id),
  // Si la vista llegara a pedir la decisión del supervisor, estos no existen y el test falla.
}));
vi.mock('../hooks/useMediaQuery', () => ({
  DESKTOP_QUERY: 'desktop',
  TABLE_LAYOUT_QUERY: 'table',
  useMediaQuery: () => escritorio.value,
}));

import { ChequeosDiariosAdminView } from './ChequeosDiariosAdminView';

const HOY = toDateOnly(new Date());

const resumen = (over: Partial<DailyChecklistSummary> & Pick<DailyChecklistSummary, 'id'>): DailyChecklistSummary => ({
  equipment: { id: `eq-${over.id}`, internalCode: 'CN-007' },
  date: HOY,
  counter: 2150,
  counterUnit: 'HOURS',
  status: 'SUBMITTED',
  mechanicName: 'Mario Mantenedor',
  submittedAt: '2026-11-20T16:05:00.000Z',
  submissionCount: 1,
  declared: 3,
  maintained: 1,
  photos: 2,
  lastReview: null,
  ...over,
});

const revision = (decision: 'ACCEPTED' | 'REJECTED', quien: string) => ({
  decision,
  comment: decision === 'REJECTED' ? 'Falta la foto del disco' : null,
  reviewerName: quien,
  submission: 1,
  createdAt: '2026-11-20T18:00:00.000Z',
});

const LISTA: DailyChecklistSummary[] = [
  resumen({ id: 'c1' }),
  resumen({
    id: 'c2',
    equipment: { id: 'eq2', internalCode: 'CA-011' },
    counter: 48200,
    counterUnit: 'KM',
    status: 'ACCEPTED',
    lastReview: revision('ACCEPTED', 'Sofía Supervisora'),
  }),
  resumen({
    id: 'c3',
    equipment: { id: 'eq3', internalCode: 'EX-001' },
    status: 'REJECTED',
    lastReview: revision('REJECTED', 'Pedro Supervisor'),
  }),
];

const DETALLE = (status: DailyChecklistDetail['status']): DailyChecklistDetail => ({
  ...resumen({ id: 'c1', status }),
  lastReview: status === 'ACCEPTED' ? revision('ACCEPTED', 'Sofía Supervisora') : null,
  entries: [
    {
      itemId: 'chk_frenos',
      itemName: 'Pastillas de frenos',
      status: 'MAINTAINED',
      description: 'Cambio de pastillas delanteras',
      note: null,
      temperature: null,
      photos: [{ id: 'a.jpg', url: 'https://firmada/a.jpg' }],
      supplies: [{ itemId: 'i1', sku: 'PAS-01', name: 'Pastilla', quantity: 2 }],
    },
    {
      itemId: 'chk_asiento',
      itemName: 'Asiento',
      status: 'CHECKED',
      description: null,
      note: null,
      temperature: null,
      photos: [],
      supplies: [],
    },
  ],
  reviews: status === 'ACCEPTED' ? [revision('ACCEPTED', 'Sofía Supervisora')] : [],
});

const ok = (data: DailyChecklistSummary[]) => ({
  data,
  isPending: false,
  isError: false,
  error: null,
  refetch: vi.fn(),
});

beforeEach(() => {
  periodoHook.mockReturnValue(ok(LISTA));
  detalleHook.mockReturnValue({ data: undefined, isPending: false, isError: false, error: null });
  escritorio.value = true;
  query.value = '';
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('ChequeosDiariosAdminView', () => {
  it('lleva el encabezado de Reportes y pide por defecto el día de hoy', () => {
    render(<ChequeosDiariosAdminView />);

    expect(screen.getByText('SMI · Reportes')).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Chequeos diarios' })).toBeTruthy();
    expect(periodoHook).toHaveBeenLastCalledWith(HOY, HOY);
    expect(screen.getByText('Chequeos de hoy')).toBeTruthy();
  });

  it('muestra los totales del período', () => {
    render(<ChequeosDiariosAdminView />);

    const valor = (label: string) =>
      within(screen.getByRole('button', { name: new RegExp(`^${label}`) })).getByText(/^\d+$/).textContent;
    expect(valor('Enviados')).toBe('3');
    expect(valor('Por validar')).toBe('1');
    expect(valor('Aceptados')).toBe('1');
    expect(valor('Rechazados')).toBe('1');
  });

  it('en escritorio es una tabla con equipo, mantenedor, contador con unidad, quién validó y estado', () => {
    render(<ChequeosDiariosAdminView />);

    const aceptado = screen.getByTestId('chequeo-fila-c2');
    expect(within(aceptado).getByText('CA-011')).toBeTruthy();
    expect(within(aceptado).getByText('48.200 km')).toBeTruthy();
    expect(within(aceptado).getByText('Sofía Supervisora')).toBeTruthy();
    expect(within(aceptado).getByText('Aceptado')).toBeTruthy();

    const pendiente = screen.getByTestId('chequeo-fila-c1');
    expect(within(pendiente).getByText('2.150 h')).toBeTruthy();
    expect(within(pendiente).getByText('Por validar')).toBeTruthy();
    // Sin columna de fecha en un solo día.
    expect(screen.queryByRole('columnheader', { name: 'Fecha' })).toBeNull();
  });

  it('en celular son tarjetas', () => {
    escritorio.value = false;
    render(<ChequeosDiariosAdminView />);

    const tarjeta = screen.getByTestId('chequeo-tarjeta-c2');
    expect(within(tarjeta).getByText('CA-011')).toBeTruthy();
    expect(within(tarjeta).getByText('Validó Sofía Supervisora')).toBeTruthy();
    expect(within(screen.getByTestId('chequeo-tarjeta-c1')).getByText('Sin validar')).toBeTruthy();
    expect(screen.queryByRole('table')).toBeNull();
  });

  it('tocar un total filtra la lista por ese estado, y tocarlo de nuevo la deja completa', () => {
    render(<ChequeosDiariosAdminView />);

    fireEvent.click(screen.getByRole('button', { name: /^Rechazados/ }));
    expect(screen.queryByTestId('chequeo-fila-c1')).toBeNull();
    expect(screen.queryByTestId('chequeo-fila-c2')).toBeNull();
    expect(screen.getByTestId('chequeo-fila-c3')).toBeTruthy();
    // El selector de estado sigue la misma elección.
    expect(screen.getByRole('tab', { name: 'Rechazados' }).getAttribute('aria-selected')).toBe('true');

    fireEvent.click(screen.getByRole('button', { name: /^Rechazados/ }));
    expect(screen.getAllByTestId(/chequeo-fila-/)).toHaveLength(3);
  });

  it('abre ya filtrada con ?estado= (atajo del dashboard) e ignora un estado inválido', () => {
    query.value = 'estado=ACCEPTED';
    render(<ChequeosDiariosAdminView />);
    expect(screen.getAllByTestId(/chequeo-fila-/).map((f) => f.dataset.testid)).toEqual(['chequeo-fila-c2']);
    cleanup();

    query.value = 'estado=CUALQUIERA';
    render(<ChequeosDiariosAdminView />);
    expect(screen.getAllByTestId(/chequeo-fila-/)).toHaveLength(3);
  });

  it('el selector de estado también filtra', () => {
    render(<ChequeosDiariosAdminView />);

    fireEvent.click(screen.getByRole('tab', { name: 'Por validar' }));
    expect(screen.getAllByTestId(/chequeo-fila-/)).toHaveLength(1);
    expect(screen.getByTestId('chequeo-fila-c1')).toBeTruthy();
  });

  it('busca por código de equipo y avisa cuando nada coincide', () => {
    render(<ChequeosDiariosAdminView />);

    fireEvent.change(screen.getByPlaceholderText('Código del equipo'), { target: { value: 'ca-0' } });
    expect(screen.getAllByTestId(/chequeo-fila-/)).toHaveLength(1);
    expect(screen.getByTestId('chequeo-fila-c2')).toBeTruthy();

    fireEvent.change(screen.getByPlaceholderText('Código del equipo'), { target: { value: 'zzz' } });
    expect(screen.getByText(/Ningún chequeo coincide/)).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Quitar filtros' }));
    expect(screen.getAllByTestId(/chequeo-fila-/)).toHaveLength(3);
  });

  it('tocar una fila abre el detalle en solo lectura, sin aceptar ni rechazar', () => {
    detalleHook.mockImplementation((id: string | null) => ({
      data: id ? DETALLE('SUBMITTED') : undefined,
      isPending: false,
      isError: false,
      error: null,
    }));
    escritorio.value = false;
    render(<ChequeosDiariosAdminView />);

    fireEvent.click(screen.getByTestId('chequeo-tarjeta-c1'));

    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText('Chequeo de CN-007')).toBeTruthy();
    expect(within(dialog).getByText('Cambio de pastillas delanteras')).toBeTruthy();
    expect(within(dialog).getByText(/Pastilla \(PAS-01\) × 2/)).toBeTruthy();
    expect(within(dialog).getByRole('link', { name: 'Abrir foto 1' }).getAttribute('href')).toBe('https://firmada/a.jpg');
    expect(within(dialog).getByText(/el supervisor lo acepta o lo rechaza desde Terreno/)).toBeTruthy();
    expect(within(dialog).queryByRole('button', { name: /Aceptar/ })).toBeNull();
    expect(within(dialog).queryByRole('button', { name: /Rechazar/ })).toBeNull();
    expect(within(dialog).queryByPlaceholderText(/falta la foto/)).toBeNull();
    expect(detalleHook).toHaveBeenLastCalledWith('c1');
  });

  it('el detalle de un chequeo aceptado dice quién lo validó', () => {
    detalleHook.mockImplementation((id: string | null) => ({
      data: id ? DETALLE('ACCEPTED') : undefined,
      isPending: false,
      isError: false,
      error: null,
    }));
    escritorio.value = false;
    render(<ChequeosDiariosAdminView />);

    fireEvent.click(screen.getByTestId('chequeo-tarjeta-c2'));
    expect(within(screen.getByRole('dialog')).getByText(/Aceptado por Sofía Supervisora/)).toBeTruthy();
  });

  it('el rango pide varios días, agrega la columna Fecha y corrige un «hasta» anterior al «desde»', () => {
    render(<ChequeosDiariosAdminView />);

    fireEvent.click(screen.getByRole('tab', { name: 'Rango' }));
    fireEvent.change(screen.getByLabelText('Desde'), { target: { value: '2026-11-01' } });
    expect(periodoHook).toHaveBeenLastCalledWith('2026-11-01', HOY);
    expect(screen.getByRole('columnheader', { name: 'Fecha' })).toBeTruthy();

    fireEvent.change(screen.getByLabelText('Hasta'), { target: { value: '2026-11-10' } });
    expect(periodoHook).toHaveBeenLastCalledWith('2026-11-01', '2026-11-10');

    // Un «desde» posterior al «hasta» arrastra el «hasta».
    fireEvent.change(screen.getByLabelText('Desde'), { target: { value: '2026-11-15' } });
    expect(periodoHook).toHaveBeenLastCalledWith('2026-11-15', '2026-11-15');
  });

  it('un rango no pasa de 92 días', () => {
    render(<ChequeosDiariosAdminView />);

    fireEvent.click(screen.getByRole('tab', { name: 'Rango' }));
    fireEvent.change(screen.getByLabelText('Desde'), { target: { value: '2026-01-01' } });
    // 1-ene + 91 días = 2-abr (el 92.º día).
    expect(periodoHook).toHaveBeenLastCalledWith('2026-01-01', '2026-04-02');
  });

  it('las flechas mueven el día; «Día siguiente» se apaga en hoy', () => {
    render(<ChequeosDiariosAdminView />);

    expect((screen.getByRole('button', { name: 'Día siguiente' }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Día anterior' }));
    const ayer = periodoHook.mock.lastCall as [string, string];
    expect(ayer[0]).toBe(ayer[1]);
    expect(ayer[0] < HOY).toBe(true);
    expect((screen.getByRole('button', { name: 'Día siguiente' }) as HTMLButtonElement).disabled).toBe(false);

    fireEvent.click(screen.getByRole('button', { name: 'Hoy' }));
    expect(periodoHook).toHaveBeenLastCalledWith(HOY, HOY);
  });

  it('sin chequeos en el período lo dice', () => {
    periodoHook.mockReturnValue(ok([]));
    render(<ChequeosDiariosAdminView />);

    expect(screen.getByText(/No hay chequeos enviados hoy/)).toBeTruthy();
  });

  it('si falla el listado muestra el error y deja reintentar', () => {
    const refetch = vi.fn();
    periodoHook.mockReturnValue({ data: undefined, isPending: false, isError: true, error: new Error('Falló el listado'), refetch });
    render(<ChequeosDiariosAdminView />);

    expect(screen.getByRole('alert').textContent).toContain('Falló el listado');
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
    expect(refetch).toHaveBeenCalled();
  });
});
