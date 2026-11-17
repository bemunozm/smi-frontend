import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';

import type { MaintenancePlanView } from '../../types/maintenance-plan';

let mockVista: MaintenancePlanView | undefined;
vi.mock('../../hooks/useMaintenancePlans', () => ({
  useMaintenancePlan: () => ({ data: mockVista, isLoading: false, isError: false, error: null }),
  useSaveMaintenancePlan: () => ({ mutate: vi.fn(), isPending: false }),
}));
vi.mock('./DocumentosPauta', () => ({ DocumentosPauta: () => null }));
vi.mock('./FechaEstimada', () => ({ FechaEstimada: () => null }));

import { PautaMantencionModal } from './PautaMantencionModal';

const EQUIPO = { id: 'eq_1', internalCode: 'BD-005', brand: 'CAT', model: 'D6' };

/** La pauta guardada con la próxima a `remaining` horas (negativo = atrasada). */
const vistaCon = (remaining: number): MaintenancePlanView => ({
  equipment: { id: 'eq_1', internalCode: 'BD-005', unit: 'h', counter: 2768 },
  plan: {
    milestones: [250, 500, 750, 1000],
    initialMilestone: null,
    alertBefore: 50,
    items: [],
    updatedAt: '2026-11-01T12:00:00.000Z',
  },
  status: {
    counter: 2768,
    cycleLength: 1000,
    positionInCycle: 768,
    next: { milestone: 750, firstTimeOnly: false, remaining, dueAt: 2768 + remaining, items: [] },
  },
});

function abrir(remaining: number) {
  mockVista = vistaCon(remaining);
  render(<PautaMantencionModal equipo={EQUIPO} isOpen onOpenChange={() => {}} soloLectura />);
}

afterEach(cleanup);

describe('PautaMantencionModal — próxima mantención', () => {
  it('atrasada se lee «+38 h atrasado» en rojo, no «faltan -38 h»', () => {
    abrir(-38);

    const texto = screen.getByText('+38 h atrasado');
    expect(texto.className).toContain('text-danger');
    expect(screen.queryByText(/faltan/)).toBeNull();
  });

  it('justo en el hito sigue diciendo «toca ahora» en rojo', () => {
    abrir(0);

    expect(screen.getByText('toca ahora').className).toContain('text-danger');
  });

  it('con margen: «faltan 150 h» sin color', () => {
    abrir(150);

    expect(screen.getByText('faltan 150 h').className).not.toContain('text-danger');
  });
});
