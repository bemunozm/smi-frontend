import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

import { ValidarChecklistsView } from './ValidarChecklistsView';
import type { DailyChecklistDetail } from '../types/daily-checklist';

const mutate = vi.fn();
let puedeValidar = true;

const DETALLE: DailyChecklistDetail = {
  id: 'chk_1',
  equipment: { id: 'eq_1', internalCode: 'CN-007' },
  date: '2026-10-16',
  counter: 2150,
  status: 'SUBMITTED',
  mechanicName: 'Mario Mantenedor',
  submittedAt: '2026-10-16T16:05:00.000Z',
  submissionCount: 1,
  declared: 2,
  maintained: 1,
  photos: 1,
  lastReview: null,
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
  reviews: [],
};

vi.mock('../hooks/useDailyChecklists', () => ({
  useChecklistsPorEstado: () => ({ data: [DETALLE], isLoading: false }),
  useDailyChecklists: () => ({ data: [] }),
  useChecklistDetalle: (id: string | null) => ({ data: id ? DETALLE : undefined, isLoading: false }),
  useReviewChecklist: () => ({ mutate, isPending: false }),
}));
vi.mock('../hooks/usePermissions', () => ({ usePermissions: () => ({ can: () => puedeValidar }) }));

function renderView(ruta = '/terreno/checklists') {
  return render(
    <MemoryRouter initialEntries={[ruta]}>
      <ValidarChecklistsView />
    </MemoryRouter>,
  );
}

afterEach(() => {
  cleanup();
  mutate.mockClear();
  puedeValidar = true;
});

describe('ValidarChecklistsView (Módulo 3)', () => {
  it('lista los pendientes y abre el detalle con lo declarado', () => {
    renderView();
    fireEvent.click(screen.getByRole('button', { name: /CN-007/ }));

    expect(screen.getByText('Checklist de CN-007')).toBeTruthy();
    expect(screen.getByText('Cambio de pastillas delanteras')).toBeTruthy();
    expect(screen.getByText(/Pastilla \(PAS-01\) × 2/)).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Abrir foto 1' }).getAttribute('href')).toBe('https://firmada/a.jpg');
  });

  it('aceptar manda la decisión con el envío que se revisó', () => {
    renderView('/terreno/checklists?id=chk_1');
    fireEvent.click(screen.getByRole('button', { name: /Aceptar y liberar equipo/ }));

    expect(mutate).toHaveBeenCalledWith(
      { id: 'chk_1', input: { decision: 'ACCEPTED', submission: 1 } },
      expect.anything(),
    );
  });

  it('rechazar exige escribir qué corregir', () => {
    renderView('/terreno/checklists?id=chk_1');
    const rechazar = screen.getByRole('button', { name: /Rechazar/ }) as HTMLButtonElement;
    expect(rechazar.disabled).toBe(true);

    fireEvent.change(screen.getByPlaceholderText(/falta la foto/), {
      target: { value: 'Falta la foto del disco' },
    });
    fireEvent.click(rechazar);

    expect(mutate).toHaveBeenCalledWith(
      {
        id: 'chk_1',
        input: { decision: 'REJECTED', submission: 1, comment: 'Falta la foto del disco' },
      },
      expect.anything(),
    );
  });

  it('sin el rol de supervisor se ve, pero no se valida', () => {
    puedeValidar = false;
    renderView('/terreno/checklists?id=chk_1');

    expect(screen.getByText(/Solo el supervisor valida/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Aceptar y liberar equipo/ })).toBeNull();
  });
});
