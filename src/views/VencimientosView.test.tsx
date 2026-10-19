import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

import { VencimientosView } from './VencimientosView';
import type { CalendarView } from '../types/vencimientos';

const MESES = [
  '2026-10',
  '2026-11',
  '2026-12',
  '2027-01',
  '2027-02',
  '2027-03',
  '2027-04',
  '2027-05',
  '2027-06',
  '2027-07',
  '2027-08',
  '2027-09',
];

const CALENDARIO: CalendarView = {
  months: MESES,
  equipment: [
    {
      id: 'eq_1',
      internalCode: 'CN-007',
      licensePlate: 'ABCD-12',
      type: 'Camioneta',
      brand: 'Toyota',
      model: 'Hilux',
      controlUnit: 'KM',
      counter: 15000,
      documents: [
        {
          id: 'd1',
          type: 'INSURANCE',
          label: 'Seguro',
          expiryDate: '2026-09-17',
          month: '2026-09',
          status: 'VENCIDO',
          daysToExpiry: -32,
          alertDaysBefore: 15,
        },
        {
          id: 'd2',
          type: 'TECHNICAL_INSPECTION',
          label: 'Revisión técnica',
          expiryDate: '2026-11-08',
          month: '2026-11',
          status: 'POR_VENCER',
          daysToExpiry: 20,
          alertDaysBefore: 30,
        },
      ],
      service: { source: 'LIVIANO', unit: 'km', nextAt: 20000, remaining: 5000, due: false },
    },
    {
      id: 'eq_2',
      internalCode: 'MB-008',
      licensePlate: 'XXYY-34',
      type: 'Camioneta',
      brand: 'Mitsubishi',
      model: 'L200',
      controlUnit: 'KM',
      counter: 29500,
      documents: [],
      service: { source: 'LIVIANO', unit: 'km', nextAt: 30000, remaining: 500, due: true },
    },
  ],
};

let escritorio = true;
vi.mock('../hooks/useMediaQuery', async (original) => ({
  ...(await original<typeof import('../hooks/useMediaQuery')>()),
  useMediaQuery: () => escritorio,
}));
vi.mock('../hooks/useVencimientos', () => ({
  useCalendarioVencimientos: () => ({ data: CALENDARIO, isLoading: false, isError: false }),
}));

function renderView() {
  return render(
    <MemoryRouter>
      <VencimientosView />
    </MemoryRouter>,
  );
}

afterEach(() => {
  cleanup();
  escritorio = true;
});

describe('VencimientosView (Módulo 4)', () => {
  it('resume vencidos, por vencer y mantenciones por hacer', () => {
    renderView();
    const resumen = screen.getByText('Documentos vencidos').closest('dl')!;
    expect(within(resumen).getAllByText('1')).toHaveLength(3);
  });

  it('en escritorio: una fila por patente y el documento en la columna de su mes', () => {
    renderView();
    const fila = screen.getByText('ABCD-12').closest('tr')!;
    const celdas = within(fila).getAllByRole('cell');
    // Patente, Vencidos, 12 meses, Mantención.
    expect(celdas).toHaveLength(15);
    expect(within(celdas[1]).getByText(/Seguro · 17-09-2026/)).toBeTruthy();
    expect(within(celdas[3]).getByText(/Revisión técnica · 08/)).toBeTruthy();
    expect(within(celdas[14]).getByText(/20\.000 km · faltan 5\.000 km/)).toBeTruthy();
  });

  it('en tablet: una tarjeta por patente con los vencimientos en orden', () => {
    escritorio = false;
    renderView();
    expect(screen.queryByRole('table')).toBeNull();
    // El rótulo de la fila del vencido (la leyenda también dice «Vencido»).
    expect(screen.getAllByText('Vencido').length).toBeGreaterThan(1);
    expect(screen.getByText(/Revisión técnica · 08-11-2026/)).toBeTruthy();
    expect(screen.getByText(/30\.000 km · faltan 500 km/)).toBeTruthy();
  });

  it('filtra por patente', () => {
    renderView();
    fireEvent.change(screen.getByLabelText('Buscar por patente o código'), { target: { value: 'xxyy' } });
    expect(screen.queryByText('ABCD-12')).toBeNull();
    expect(screen.getByText('XXYY-34')).toBeTruthy();
  });
});
