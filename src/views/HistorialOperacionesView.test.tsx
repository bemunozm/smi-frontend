import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

import type { OrdenTrabajo } from '../types/mantenimiento';

function orden(overrides: Partial<OrdenTrabajo> & Pick<OrdenTrabajo, 'id'>): OrdenTrabajo {
  return {
    equipoId: 'EX-014',
    hallazgoId: null,
    pautaMilestone: null,
    pautaCycle: null,
    titulo: 'Fuga de aceite hidráulico en pluma',
    estado: 'COMPLETADA',
    prioridad: 'MEDIA',
    tipo: 'CORRECTIVA',
    origen: 'MANUAL',
    origenDetalle: null,
    asignadoA: null,
    tareas: [],
    createdAt: '2026-10-01T10:00:00.000Z',
    updatedAt: '2026-10-01T10:00:00.000Z',
    ...overrides,
  };
}

const ORDENES: OrdenTrabajo[] = [
  orden({ id: 'vieja', titulo: 'Cambio de neumáticos', updatedAt: '2026-09-02T10:00:00.000Z' }),
  orden({
    id: 'nueva',
    equipoId: 'RE-003',
    titulo: 'Mantención 500 h',
    tipo: 'PREVENTIVA',
    origen: 'MANUAL',
    updatedAt: '2026-11-15T10:00:00.000Z',
    asignadoA: { id: 'm1', nombre: 'Pedro Pérez' },
  }),
  orden({ id: 'cancelada', titulo: 'Revisión de frenos', estado: 'CANCELADA', updatedAt: '2026-10-20T10:00:00.000Z' }),
  // No finalizada: no entra al historial.
  orden({ id: 'en-proceso', titulo: 'Cambio de correa', estado: 'EN_PROCESO' }),
];

vi.mock('../hooks/useOrdenes', () => ({
  useOrdenes: () => ({ data: ORDENES, isPending: false, isError: false, error: null }),
}));
vi.mock('../hooks/useEquipment', () => ({
  useEquipment: () => ({
    data: [
      { id: 'e1', internalCode: 'EX-014', brand: 'Komatsu', model: 'PC200' },
      { id: 'e2', internalCode: 'RE-003', brand: 'Volvo', model: 'L90' },
    ],
  }),
}));
// Los modales de solo lectura tienen sus propios tests: acá basta su botón.
vi.mock('../components/mantenimiento/ViewOperationModal', () => ({
  ViewOperationModal: () => <button type="button">Ver operación</button>,
}));
vi.mock('../components/mantenimiento/PreventiveChecklistModal', () => ({
  PreventiveChecklistModal: () => <button type="button">Ver mantención</button>,
}));

import { HistorialOperacionesView } from './HistorialOperacionesView';

function renderView() {
  return render(
    <MemoryRouter>
      <HistorialOperacionesView />
    </MemoryRouter>,
  );
}

afterEach(() => {
  cleanup();
});

describe('HistorialOperacionesView', () => {
  it('lista en tabla todas las finalizadas y canceladas, de la más reciente a la más antigua', () => {
    renderView();
    const filas = screen.getAllByTestId(/^historial-fila-/).map((fila) => fila.getAttribute('data-testid'));
    expect(filas).toEqual(['historial-fila-nueva', 'historial-fila-cancelada', 'historial-fila-vieja']);
    expect(screen.queryByText('Cambio de correa')).toBeNull();

    const nueva = screen.getByTestId('historial-fila-nueva');
    expect(within(nueva).getByText('RE-003')).toBeTruthy();
    expect(within(nueva).getByText('Pedro Pérez')).toBeTruthy();
    expect(within(nueva).getByRole('button', { name: 'Ver operación' })).toBeTruthy();
    expect(within(screen.getByTestId('historial-fila-cancelada')).getByText('Cancelada')).toBeTruthy();
    expect(screen.getByText('3 operaciones')).toBeTruthy();
  });

  it('busca por equipo u operación y filtra por tipo', () => {
    renderView();
    fireEvent.change(screen.getByLabelText('Buscar en el historial'), { target: { value: 'volvo' } });
    expect(screen.getAllByTestId(/^historial-fila-/)).toHaveLength(1);
    expect(screen.getByTestId('historial-fila-nueva')).toBeTruthy();

    fireEvent.change(screen.getByLabelText('Buscar en el historial'), { target: { value: '' } });
    fireEvent.click(within(screen.getByRole('group', { name: 'Tipo de operación' })).getByRole('button', { name: /Correctivas/ }));
    expect(screen.queryByTestId('historial-fila-nueva')).toBeNull();
    expect(screen.getByTestId('historial-fila-vieja')).toBeTruthy();

    fireEvent.change(screen.getByLabelText('Buscar en el historial'), { target: { value: 'no existe' } });
    expect(screen.getByText('Ninguna operación del historial calza con el filtro.')).toBeTruthy();
  });

  it('tiene la vuelta al tablero', () => {
    renderView();
    expect(screen.getByRole('link', { name: /Volver al tablero/ }).getAttribute('href')).toBe('/mantenimiento/ordenes');
  });
});
