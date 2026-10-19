import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

import { CalendarioVencimientosCard } from './CalendarioVencimientosCard';
import type { CalendarView } from '../../types/vencimientos';

const CALENDARIO: CalendarView = {
  months: [
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
  ],
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
  ],
};

let rol: string = 'ADMIN';
const pedido = vi.fn();
vi.mock('../../hooks/useCurrentUser', () => ({ useCurrentUser: () => ({ role: rol }) }));
vi.mock('../../hooks/useVencimientos', () => ({
  useCalendarioVencimientos: (desde: string | undefined, equipmentId: string, enabled: boolean) => {
    pedido(desde, equipmentId, enabled);
    return { data: CALENDARIO, isLoading: false, isError: false };
  },
}));

function renderCard(equipmentClass = 'LIGHT') {
  return render(
    <MemoryRouter>
      <CalendarioVencimientosCard base="/equipos" equipo={{ id: 'eq_1', equipmentClass }} />
    </MemoryRouter>,
  );
}

afterEach(() => {
  cleanup();
  rol = 'ADMIN';
  pedido.mockClear();
});

describe('CalendarioVencimientosCard (ficha del liviano)', () => {
  it('muestra los vencimientos del equipo y su próxima mantención', () => {
    renderCard();
    expect(screen.getByText('Calendario de vencimientos')).toBeTruthy();
    expect(screen.getByText(/Revisión técnica · 08-11-2026/)).toBeTruthy();
    expect(screen.getByText(/20\.000 km · faltan 5\.000 km/)).toBeTruthy();
    expect(screen.getByRole('link', { name: /Ver todos los livianos/ }).getAttribute('href')).toBe(
      '/equipos/vencimientos',
    );
    expect(pedido).toHaveBeenCalledWith(undefined, 'eq_1', true);
  });

  it('no aparece en equipos pesados', () => {
    renderCard('HEAVY');
    expect(screen.queryByText('Calendario de vencimientos')).toBeNull();
  });

  it('no aparece para el supervisor (no recibe los avisos)', () => {
    rol = 'SUPERVISOR';
    renderCard();
    expect(screen.queryByText('Calendario de vencimientos')).toBeNull();
  });
});
