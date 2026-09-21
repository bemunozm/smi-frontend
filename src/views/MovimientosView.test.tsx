import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';

import { MovimientosView } from './MovimientosView';
import type { StockMovement } from '../types/inventory';

afterEach(cleanup);

function setViewport(size: 'phone' | 'desktop'): void {
  window.matchMedia = ((query: string) => ({
    matches: size === 'desktop' && query.includes('1024px'),
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
}

const CASA = { id: 'b1', name: 'Casa Matriz' };
const FAENA = { id: 'b2', name: 'Faena' };

const BRANCHES = [
  {
    ...CASA,
    address: null,
    isActive: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
  {
    ...FAENA,
    address: null,
    isActive: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
];

function movement(over: Partial<StockMovement> & { id: string }): StockMovement {
  return {
    itemId: 'i1',
    branchId: 'b1',
    direction: 'IN',
    reason: 'PURCHASE',
    quantity: 10,
    resultingBalance: 40,
    reference: null,
    documentNumber: null,
    performedById: 'u1',
    equipmentId: null,
    notes: null,
    occurredAt: '2026-09-12T12:00:00.000Z',
    branch: CASA,
    item: { id: 'i1', sku: 'FIL-001', name: 'Filtro de aceite', unit: 'UNIT' },
    ...over,
  } as StockMovement;
}

const COMPRA = movement({ id: 'm1', documentNumber: 'GD-4471' });

const TRASPASO_SALIDA = movement({
  id: 'm2',
  direction: 'OUT',
  reason: 'TRANSFER',
  quantity: 3,
  resultingBalance: 37,
  destinationBranch: FAENA,
});

function renderView(
  movements: StockMovement[],
  size: 'phone' | 'desktop' = 'desktop',
) {
  setViewport(size);

  const qc = new QueryClient();
  qc.setQueryData(['branches', { isActive: true }], BRANCHES);
  qc.setQueryData(['inventory', 'movements', { limit: 200 }], movements);

  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <MovimientosView />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('MovimientosView', () => {
  it('lista lo que pasó con el inventario completo', () => {
    renderView([COMPRA]);

    const tabla = within(screen.getByLabelText('Historial de inventario'));
    expect(tabla.getByText('FIL-001')).toBeTruthy();
    expect(tabla.getByText('Compra / reposición')).toBeTruthy();
    expect(tabla.getByText('Casa Matriz')).toBeTruthy();
    expect(tabla.getByText('GD-4471')).toBeTruthy();
  });

  it('escribe el recorrido del traspaso, origen → destino', () => {
    // Un traspaso son dos asientos; sin decir de dónde a dónde, el renglón de
    // salida se lee igual que material consumido.
    renderView([TRASPASO_SALIDA]);

    expect(screen.getByText('Casa Matriz → Faena')).toBeTruthy();
    expect(screen.getByText('Traspaso')).toBeTruthy();
  });

  it('agrupa por lo que la gente pregunta, no por la dirección del asiento', () => {
    renderView([COMPRA]);

    for (const label of ['Entradas', 'Salidas', 'Traspasos', 'Ajustes']) {
      expect(screen.getByRole('tab', { name: label })).toBeTruthy();
    }
  });

  it('en teléfono usa tarjetas', () => {
    renderView([COMPRA], 'phone');

    expect(screen.queryByLabelText('Historial de inventario')).toBeNull();
    expect(screen.getByText('FIL-001')).toBeTruthy();
  });

  it('filtra el período con un solo calendario de rango', () => {
    // El rango es UNA decisión («la semana pasada»), no dos. Con dos campos
    // sueltos hay que abrir dos veces y cuidar a mano que el desde no quede
    // después del hasta.
    renderView([COMPRA]);

    expect(screen.getByText('Período')).toBeTruthy();
    expect(screen.queryByText('Desde')).toBeNull();
    expect(screen.queryByText('Hasta')).toBeNull();
  });

  it('el calendario tiene un ancla a la que pegarse', () => {
    // Regresión: sin el `Group` de react-aria el popover no tiene ancla y se
    // dibuja en la esquina de la pantalla, encima del menú lateral, en vez de
    // bajo el campo que se apretó.
    renderView([COMPRA]);

    const grupo = document.querySelector('[role="group"]');
    expect(grupo).not.toBeNull();
    expect(
      grupo?.querySelector('[data-slot="date-range-picker-trigger"]'),
    ).not.toBeNull();
  });

  it('renombra el saldo a stock, que es como lo llaman', () => {
    renderView([COMPRA]);

    const tabla = within(screen.getByLabelText('Historial de inventario'));
    expect(tabla.getByText('Stock')).toBeTruthy();
    expect(tabla.queryByText('Saldo')).toBeNull();
  });

  it('dice qué hacer cuando el período no tiene movimientos', () => {
    renderView([]);

    expect(screen.getByText('No hay movimientos en este período')).toBeTruthy();
  });
});
