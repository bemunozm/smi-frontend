import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';

import type { OutboxOp } from '../offline/db';
import { EquiposView } from './EquiposView';

/**
 * Las listas de oficina NO muestran filas optimistas: lo guardado sin señal se ve
 * en la franja de arriba y como "sin sincronizar" en la fila de la entidad que ya
 * existe, para que nadie vuelva a crear algo que no ve en la lista.
 */
let mockOps: OutboxOp[] = [];
vi.mock('../offline/useOutboxOps', () => ({ useOutboxOps: () => mockOps }));

vi.mock('../hooks/useCurrentUser', () => ({
  useCurrentUser: () => ({
    user: { id: 'u1', name: 'Admin SMI', email: 'admin@smi.local', role: 'ADMIN' },
    role: 'ADMIN',
    isPending: false,
    isAuthenticated: true,
  }),
}));
vi.mock('../hooks/useBranches', () => ({ useBranches: () => ({ data: [] }) }));

const EQUIPO = {
  id: 'eq_1',
  internalCode: 'EX-001',
  licensePlate: null,
  equipmentClass: 'HEAVY' as const,
  type: 'Excavadora',
  brand: 'Caterpillar',
  model: '336',
  year: 2019,
  controlUnit: 'HOURS' as const,
  currentHourmeter: 1200,
  currentMileage: null,
  status: 'OPERATIONAL' as const,
  homeBranchId: null,
  photoUrl: null,
  operator: null,
  supervisor: null,
  inUse: false,
  currentFuelLevel: null,
  openShift: null,
  documentsAlert: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

function op(overrides: Partial<OutboxOp>): OutboxOp {
  return {
    id: 'w-1',
    type: 'httpWrite',
    v: 1,
    userId: 'u1',
    endpoint: 'equipment.status',
    params: { id: 'eq_1' },
    body: { status: 'IN_WORKSHOP' },
    label: 'Cambio de estado · EX-001',
    status: 'pending',
    attempts: 0,
    seq: 1,
    entityKey: 'equipment:eq_1',
    createdAt: 1,
    updatedAt: 1,
    ...overrides,
  } as OutboxOp;
}

function renderView() {
  const qc = new QueryClient({ defaultOptions: { queries: { staleTime: Infinity, retry: false } } });
  qc.setQueryData(['equipment'], [EQUIPO]);
  qc.setQueryData(['equipment', 'resumen'], { total: 1, disponibles: 1, porEstado: { OPERATIONAL: 1, IN_WORKSHOP: 0, OUT_OF_SERVICE: 0 } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <EquiposView />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  mockOps = [];
});

afterEach(cleanup);

describe('EquiposView — lo que espera sincronizarse', () => {
  it('sin nada pendiente no hay franja ni marca', () => {
    renderView();

    expect(screen.queryByText(/sin sincronizar/)).toBeNull();
  });

  it('una creación pendiente se ve en la franja (no hay una fila optimista en la lista)', () => {
    mockOps = [
      op({
        id: 'w-2',
        endpoint: 'equipment.create',
        entityKey: 'equipment:eq_9',
        label: 'Nuevo equipo · CM-009',
        creates: true,
        body: { id: 'eq_9', internalCode: 'CM-009' },
      } as Partial<OutboxOp>),
    ];

    renderView();

    expect(screen.getByRole('status').textContent).toContain('1 cambio sin sincronizar');
    expect(screen.getByText('Nuevo equipo · CM-009')).toBeTruthy();
    // La lista sigue mostrando solo lo que confirmó el servidor.
    expect(screen.queryByText('CM-009', { selector: 'span.font-mono' })).toBeNull();
  });

  it('un cambio sobre un equipo que ya existe marca su fila como "sin sincronizar"', () => {
    mockOps = [op({})];

    renderView();

    expect(screen.getByText('1 cambio sin sincronizar')).toBeTruthy();
    const marcas = screen.getAllByText('Edición sin sincronizar');
    expect(marcas.length).toBeGreaterThan(0);
  });

  it('si el servidor lo rechazó, la marca manda a Sincronización', () => {
    mockOps = [op({ status: 'needs_attention' })];

    renderView();

    expect(within(screen.getByRole('status')).getByText(/requiere atención/)).toBeTruthy();
    expect(screen.getAllByText('Requiere atención · ver Sincronización').length).toBeGreaterThan(0);
  });

  it('lo de otro módulo no aparece acá', () => {
    mockOps = [op({ endpoint: 'item.update', entityKey: 'item:it_1', label: 'Edición de ítem' })];

    renderView();

    expect(screen.queryByText(/sin sincronizar/)).toBeNull();
  });
});
