import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

import type { Intervencion, OrdenTrabajo } from '../../types/mantenimiento';

let intervencionesResult: {
  data: Intervencion[] | undefined;
  isPending: boolean;
  isError: boolean;
} = { data: [], isPending: false, isError: false };

vi.mock('../../hooks/useIntervenciones', () => ({
  useIntervenciones: () => intervencionesResult,
  useFinishTask: () => ({ mutate: vi.fn(), isPending: false }),
  useCrearIntervencion: () => ({ mutate: vi.fn(), isPending: false }),
}));

vi.mock('../../hooks/useInventory', () => ({
  useItems: () => ({ data: [], isPending: false }),
}));

import { ViewOperationModal } from './ViewOperationModal';

const ORDEN: OrdenTrabajo = {
  id: 'ot-3',
  equipoId: 'RE-003',
  titulo: 'Engrase general y cambio de pernos',
  estado: 'COMPLETADA',
  prioridad: 'MEDIA',
  tipo: 'PREVENTIVA',
  origen: 'PREVENTIVO',
  origenDetalle: null,
  asignadoA: null,
  tareas: [],
  createdAt: '2026-10-05T08:30:00.000Z',
  updatedAt: '2026-10-05T11:05:00.000Z',
};

afterEach(() => {
  cleanup();
  intervencionesResult = { data: [], isPending: false, isError: false };
});

function openModal() {
  render(
    <MemoryRouter>
      <ViewOperationModal equipment={undefined} orden={ORDEN} />
    </MemoryRouter>,
  );
  fireEvent.click(screen.getByRole('button', { name: /Ver operación/ }));
}

describe('ViewOperationModal', () => {
  it('muestra la intervención de cierre cuando existe', () => {
    intervencionesResult = {
      data: [
        {
          id: 'int-1',
          ordenId: 'ot-3',
          tipo: 'PREVENTIVA',
          detalle: 'Engrase de bujes y cambio de 6 pernos.',
          horasHombre: 3,
          horometro: 3220,
          soloLectura: true,
          insumos: [],
          fecha: '2026-10-05T11:05:00.000Z',
        },
      ],
      isPending: false,
      isError: false,
    };
    openModal();
    expect(screen.getByText('Engrase de bujes y cambio de 6 pernos.')).toBeTruthy();
    expect(screen.getByText('3220 h')).toBeTruthy();
  });

  it('sin intervenciones muestra el vacío amable', () => {
    openModal();
    expect(screen.getByText('Sin bitácora registrada')).toBeTruthy();
  });

  it('si la bitácora FALLA al cargar, dice que falló — no "sin bitácora" (eso sería afirmar algo falso)', () => {
    intervencionesResult = { data: undefined, isPending: false, isError: true };
    openModal();
    expect(screen.getByRole('alert').textContent).toMatch(/No se pudo cargar la bitácora/);
    expect(screen.queryByText('Sin bitácora registrada')).toBeNull();
  });
});
