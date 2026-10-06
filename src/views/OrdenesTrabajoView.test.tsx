import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

import type { OrdenTrabajo } from '../types/mantenimiento';

function orden(overrides: Partial<OrdenTrabajo>): OrdenTrabajo {
  return {
    id: 'ot-x',
    equipoId: 'EX-014',
    titulo: 'Sin título',
    estado: 'PENDIENTE',
    prioridad: 'MEDIA',
    tipo: 'CORRECTIVA',
    origen: 'HALLAZGO',
    origenDetalle: null,
    asignadoA: null,
    tareas: [],
    createdAt: '2026-10-05T07:50:00.000Z',
    updatedAt: '2026-10-05T07:50:00.000Z',
    ...overrides,
  };
}

const ORDENES: OrdenTrabajo[] = [
  orden({
    id: 'ot-1',
    titulo: 'Fuga de aceite hidráulico en pluma',
    estado: 'PENDIENTE',
    prioridad: 'CRITICA',
    origenDetalle: 'J. Soto · Operador',
  }),
  orden({
    id: 'ot-2',
    equipoId: 'CM-007',
    titulo: 'Cambio de aceite motor y filtro',
    estado: 'EN_PROCESO',
    tipo: 'PREVENTIVA',
    origen: 'MANUAL',
  }),
  orden({
    id: 'ot-3',
    equipoId: 'RE-003',
    titulo: 'Engrase general y cambio de pernos',
    estado: 'COMPLETADA',
    tipo: 'PREVENTIVA',
    origen: 'PREVENTIVO',
  }),
];

const EQUIPMENT = [
  { id: 'eq-1', internalCode: 'EX-014', brand: 'CAT', model: '320' },
  { id: 'eq-2', internalCode: 'CM-007', brand: 'Volvo', model: 'FMX' },
  { id: 'eq-3', internalCode: 'RE-003', brand: 'CAT', model: '416' },
];

// Permisos como los resuelve `lib/permissions` para cada rol (espejo del
// backend): MANTENEDOR inicia/finaliza pero no crea; ADMIN crea pero el POST
// de intervenciones no es suyo.
const CAN_MANTENEDOR = new Set(['orden.update', 'orden.toggleTarea', 'intervencion.create']);
const CAN_ADMIN = new Set(['orden.create', 'orden.update', 'orden.toggleTarea']);
let allowed: ReadonlySet<string> = CAN_MANTENEDOR;

vi.mock('../hooks/usePermissions', () => ({
  usePermissions: () => ({
    role: null,
    can: (action: string) => allowed.has(action),
    canAny: (actions: readonly string[]) => actions.some((action) => allowed.has(action)),
    canCloseShiftCardFromFleet: false,
  }),
}));

vi.mock('../hooks/usePendingWrites', () => ({
  usePendingWrites: () => ({ ops: [], pendientes: 0, atencion: 0, marcaDe: () => null }),
}));

vi.mock('../components/sync/PendientesStrip', () => ({
  PendientesStrip: () => null,
}));

vi.mock('../hooks/useOrdenes', () => ({
  useOrdenes: () => ({ data: ORDENES, isPending: false, isError: false, error: null }),
  useCrearOrden: () => ({ mutate: vi.fn(), isPending: false }),
  useActualizarOrden: () => ({ mutate: vi.fn(), isPending: false }),
  useLogOperation: () => ({ mutate: vi.fn(), isPending: false }),
  useToggleTarea: () => ({ mutate: vi.fn(), isPending: false }),
  useOrden: () => ({ data: undefined }),
}));

vi.mock('../hooks/useEquipment', () => ({
  useEquipment: () => ({ data: EQUIPMENT, isPending: false }),
}));

vi.mock('../hooks/useInventory', () => ({
  useItems: () => ({ data: [], isPending: false }),
}));

vi.mock('../hooks/useIntervenciones', () => ({
  useIntervenciones: () => ({ data: [], isPending: false, isError: false }),
  useFinishTask: () => ({ mutate: vi.fn(), isPending: false }),
  useCrearIntervencion: () => ({ mutate: vi.fn(), isPending: false }),
}));

import { OrdenesTrabajoView } from './OrdenesTrabajoView';

afterEach(() => {
  cleanup();
  allowed = CAN_MANTENEDOR;
});

function renderView() {
  return render(
    <MemoryRouter>
      <OrdenesTrabajoView />
    </MemoryRouter>,
  );
}

describe('OrdenesTrabajoView (tablero del taller)', () => {
  it('reparte las órdenes en las tres columnas del tablero', () => {
    renderView();

    const backlog = screen.getByRole('region', { name: 'Hallazgos' });
    const inProgress = screen.getByRole('region', { name: 'Operación en proceso' });
    const finished = screen.getByRole('region', { name: 'Finalizado' });

    expect(within(backlog).getByText('Fuga de aceite hidráulico en pluma')).toBeTruthy();
    expect(within(inProgress).getByText('Cambio de aceite motor y filtro')).toBeTruthy();
    expect(within(finished).getByText('Engrase general y cambio de pernos')).toBeTruthy();
  });

  it('resuelve el nombre del equipo desde Flota', () => {
    renderView();
    expect(screen.getByText('EX-014 · CAT 320')).toBeTruthy();
  });

  it('como MANTENEDOR: puede iniciar y finalizar, pero no crear órdenes', () => {
    renderView();

    expect(screen.getByRole('button', { name: /Iniciar operación/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Finalizar tarea/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Ver operación/ })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Crear orden/ })).toBeNull();
  });

  it('como ADMIN: puede crear órdenes pero no finalizar (el POST de bitácora es del mantenedor)', () => {
    allowed = CAN_ADMIN;
    renderView();

    expect(screen.getByRole('button', { name: /Crear orden/ })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Finalizar tarea/ })).toBeNull();
  });
});
