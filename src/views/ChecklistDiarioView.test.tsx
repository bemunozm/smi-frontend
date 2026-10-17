import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';

import { MemoryRouter } from 'react-router-dom';

import { ChecklistDiarioView } from './ChecklistDiarioView';
import type { ChecklistItem } from '../types/daily-checklist';

const mutate = vi.fn();

const ITEMS: ChecklistItem[] = [
  { id: 'ac', name: 'Aire acondicionado', position: 1, requiresPhoto: true, requiresTemperature: true },
  { id: 'espejos', name: 'Espejos', position: 2, requiresPhoto: false, requiresTemperature: false },
];

vi.mock('../hooks/useDailyChecklists', () => ({
  useChecklistItems: () => ({ data: ITEMS, isLoading: false }),
  useDailyChecklists: () => ({ data: [] }),
  useSubmitDailyChecklist: () => ({ mutate, isPending: false }),
  useResubmitDailyChecklist: () => ({ mutate, isPending: false }),
  useChecklistsPorEstado: () => ({ data: [] }),
  useChecklistDetalle: () => ({ data: undefined }),
}));
vi.mock('../hooks/useEquipment', () => ({
  useEquipment: () => ({
    data: [
      {
        id: 'eq_1',
        internalCode: 'BD-005',
        type: 'Bulldozer',
        controlUnit: 'HOURS',
        currentHourmeter: 2100,
        currentMileage: null,
      },
    ],
  }),
}));
let puedeEnviar = true;
vi.mock('../hooks/usePermissions', () => ({ usePermissions: () => ({ can: () => puedeEnviar }) }));
vi.mock('../components/mantenimiento/insumos-faena', () => ({
  useInsumosFaena: () => ({ faenaBranch: { id: 'faena' }, opcionesInsumo: [] }),
}));

afterEach(() => {
  puedeEnviar = true;
  cleanup();
  mutate.mockClear();
});

describe('ChecklistDiarioView', () => {
  it('muestra la planilla y no deja enviar hasta cumplir las reglas', () => {
    render(
      <MemoryRouter>
        <ChecklistDiarioView />
      </MemoryRouter>,
    );

    expect(screen.getByRole('heading', { name: 'Aire acondicionado' })).toBeTruthy();
    expect(screen.getByText('Crítico · foto si hay mantención')).toBeTruthy();
    const enviar = screen.getByRole('button', { name: 'Enviar al supervisor' }) as HTMLButtonElement;
    expect(enviar.disabled).toBe(true);
    expect(screen.getByText('· Elige el equipo.')).toBeTruthy();

    // «Se revisó» en un crítico no pide foto; «Se hizo mantención» sí.
    const estados = screen.getByRole('group', { name: 'Estado de Aire acondicionado' });
    fireEvent.click(within(estados).getByRole('button', { name: 'Se revisó' }));
    expect(screen.getByLabelText(/Temperatura/)).toBeTruthy();
    expect(screen.queryByText(/falta la foto obligatoria/)).toBeNull();
    fireEvent.click(within(estados).getByRole('button', { name: 'Se hizo mantención' }));
    expect(screen.getByText('· «Aire acondicionado»: falta la foto obligatoria de la mantención.')).toBeTruthy();
    expect(screen.getByText('Fotos obligatorias:', { exact: false })).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Todos «No se revisó»' }));
    expect(screen.queryByText(/ítems por marcar|Falta marcar/)).toBeNull();
    expect(screen.getByText('2 ítems · todos marcados')).toBeTruthy();
    expect(mutate).not.toHaveBeenCalled();
  });

  it('«Todos Se revisó» marca el resto sin pedir fotos', () => {
    render(
      <MemoryRouter>
        <ChecklistDiarioView />
      </MemoryRouter>,
    );
    expect(screen.getByText(/si es crítico/)).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Todos «Se revisó»' }));

    expect(screen.getByText('Falta temperatura')).toBeTruthy();
    expect(screen.queryByText(/Falta foto/)).toBeNull();
    expect(screen.getByText('1 por completar')).toBeTruthy();
    expect((screen.getByRole('button', { name: 'Enviar al supervisor' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('si la sesión no es de mantenedor, dice por qué no puede enviar', () => {
    puedeEnviar = false;
    render(
      <MemoryRouter>
        <ChecklistDiarioView />
      </MemoryRouter>,
    );
    expect(screen.getByText(/Solo un mantenedor puede enviar el checklist/)).toBeTruthy();
    expect((screen.getByRole('button', { name: 'Enviar al supervisor' }) as HTMLButtonElement).disabled).toBe(true);
  });
});
