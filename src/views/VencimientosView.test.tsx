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

// Fecha estimada por uso: CN-007 llegaría a los 20.000 km el lun 16-11.
vi.mock('../hooks/useMaintenancePlans', () => ({
  useMaintenanceForecastByEquipment: () => ({
    data: new Map([
      [
        'eq_1',
        {
          equipmentId: 'eq_1',
          unit: 'km',
          source: 'LIVIANO',
          nextAt: 20000,
          remaining: 5000,
          status: 'ESTIMADA',
          dailyUsage: 220,
          basedOnDays: 28,
          estimatedDate: '2026-11-16',
          weekStart: '2026-11-10',
          suggestedDate: '2026-11-15',
        },
      ],
    ]),
  }),
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
    const resumen = screen.getByText('Papeles vencidos').closest('dl')!;
    expect(within(resumen).getAllByText('1')).toHaveLength(3);
  });

  it('por documento (escritorio): una columna por papel, con fecha, plazo y estado; lo más urgente arriba', () => {
    renderView();
    const filas = screen.getAllByRole('row').slice(1);
    // CN-007 tiene el seguro vencido: va primero.
    expect(within(filas[0]).getByText('ABCD-12')).toBeTruthy();
    const celdas = within(filas[0]).getAllByRole('cell');
    // Vehículo, Revisión técnica, Permiso de circulación, Seguro, Mantención.
    expect(celdas).toHaveLength(5);
    expect(within(celdas[0]).getByText('2 papeles por revisar')).toBeTruthy();
    expect(within(celdas[0]).getByText('Falta 1 papel')).toBeTruthy();
    expect(within(celdas[1]).getByText('Por vencer')).toBeTruthy();
    expect(within(celdas[1]).getByText('08-11-2026')).toBeTruthy();
    expect(within(celdas[1]).getByText('vence en 20 días')).toBeTruthy();
    expect(within(celdas[2]).getByText('Sin cargar')).toBeTruthy();
    expect(within(celdas[3]).getByText('Vencido')).toBeTruthy();
    expect(within(celdas[3]).getByText('venció hace 32 días')).toBeTruthy();
    expect(within(celdas[4]).getByText(/20.000 km · faltan 5.000 km/)).toBeTruthy();
    // MB-008 no tiene papeles cargados: se dice que faltan, no que está al día.
    expect(within(filas[1]).getByText('Faltan 3 papeles')).toBeTruthy();
  });

  it('calendario 12 meses (escritorio): el documento en la columna de su mes', () => {
    renderView();
    fireEvent.click(screen.getByRole('button', { name: 'Calendario 12 meses' }));
    const fila = screen.getByText('ABCD-12').closest('tr')!;
    const celdas = within(fila).getAllByRole('cell');
    // Patente, Vencidos, 12 meses, Mantención.
    expect(celdas).toHaveLength(15);
    expect(within(celdas[1]).getByText(/Seguro · 17-09-2026/)).toBeTruthy();
    expect(within(celdas[3]).getByText(/Revisión técnica · día 8/)).toBeTruthy();
    expect(within(celdas[14]).getByText(/20.000 km · faltan 5.000 km/)).toBeTruthy();
  });

  it('por documento (tablet): una tarjeta por patente, un renglón por papel', () => {
    escritorio = false;
    renderView();
    expect(screen.queryByRole('table')).toBeNull();
    expect(screen.getByText('venció hace 32 días')).toBeTruthy();
    expect(screen.getByText('vence en 20 días')).toBeTruthy();
    expect(screen.getByText(/30.000 km · faltan 500 km/)).toBeTruthy();
  });

  it('calendario 12 meses (tablet): los vencimientos en orden', () => {
    escritorio = false;
    renderView();
    fireEvent.click(screen.getByRole('button', { name: 'Calendario 12 meses' }));
    expect(screen.getByText(/Revisión técnica · 08-11-2026/)).toBeTruthy();
  });

  it('filtra por patente', () => {
    renderView();
    fireEvent.change(screen.getByLabelText('Buscar por patente o código'), { target: { value: 'xxyy' } });
    expect(screen.queryByText('ABCD-12')).toBeNull();
    expect(screen.getByText('XXYY-34')).toBeTruthy();
  });
});
