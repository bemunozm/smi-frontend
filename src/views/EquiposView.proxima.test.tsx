import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';

import { MAINTENANCE_PLANS_KEY } from '../lib/query-keys';
import type { MaintenanceStatusRow } from '../types/maintenance-plan';
import { EquiposView } from './EquiposView';

/**
 * «Próx. mant.» bajo el horómetro: contada desde el último cambio real, la
 * próxima puede estar pasada (`remaining` negativo) y no puede leerse como
 * «faltan -38 h».
 */
vi.mock('../offline/useOutboxOps', () => ({ useOutboxOps: () => [] }));
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
  currentHourmeter: 2768,
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

function renderCon(remaining: number) {
  const qc = new QueryClient({ defaultOptions: { queries: { staleTime: Infinity, retry: false } } });
  qc.setQueryData(['equipment'], [EQUIPO]);
  qc.setQueryData(['equipment', 'resumen'], {
    total: 1,
    disponibles: 1,
    porEstado: { OPERATIONAL: 1, IN_WORKSHOP: 0, OUT_OF_SERVICE: 0 },
  });
  const fila: MaintenanceStatusRow = {
    equipmentId: 'eq_1',
    unit: 'h',
    alertBefore: 50,
    status: {
      counter: 2768,
      cycleLength: 2000,
      positionInCycle: 768,
      next: { milestone: 750, firstTimeOnly: false, remaining, dueAt: 2768 + remaining, items: [] },
    },
  };
  qc.setQueryData([...MAINTENANCE_PLANS_KEY, 'status'], [fila]);
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <EquiposView />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

afterEach(cleanup);

describe('EquiposView — próxima mantención', () => {
  it('atrasada se lee «+38 h atrasado» en rojo, no «faltan -38 h»', () => {
    renderCon(-38);

    const textos = screen.getAllByText(/Próx\. mant\. 750 h/);
    expect(textos.length).toBeGreaterThan(0);
    for (const t of textos) {
      expect(t.textContent).toContain('+38 h atrasado');
      expect(t.textContent).not.toContain('faltan');
      expect(t.className).toContain('text-danger');
    }
  });

  it('justo en el hito sigue diciendo «toca ahora»', () => {
    renderCon(0);

    for (const t of screen.getAllByText(/Próx\. mant\. 750 h/)) {
      expect(t.textContent).toContain('toca ahora');
      expect(t.className).toContain('text-danger');
    }
  });

  it('dentro del margen de aviso: «faltan 30 h» en advertencia', () => {
    renderCon(30);

    for (const t of screen.getAllByText(/Próx\. mant\. 750 h/)) {
      expect(t.textContent).toContain('faltan 30 h');
      expect(t.className).toContain('text-warning');
    }
  });
});
