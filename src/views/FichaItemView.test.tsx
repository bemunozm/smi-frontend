import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

import { FichaItemView } from './FichaItemView';
import type { InventoryItem, StockMovement } from '../types/inventory';

vi.mock('../hooks/useCurrentUser', () => ({
  useCurrentUser: () => ({
    user: { id: 'u1', name: 'Admin', email: 'a@smi.local', role: 'ADMIN' },
    role: 'ADMIN',
    isPending: false,
    isAuthenticated: true,
  }),
}));

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

afterEach(cleanup);

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

const ITEM: InventoryItem = {
  id: 'i1',
  sku: 'ACE-002',
  name: 'Aceite hidráulico ISO 68',
  description: 'Bidón de 20 litros',
  unit: 'LITER',
  type: 'SUPPLY',
  categoryId: 'c1',
  category: { id: 'c1', name: 'Lubricantes y fluidos' },
  partNumber: '1R-0750',
  defaultSupplier: 'Comercial Iquique',
  isCritical: true,
  isActive: true,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  stocks: [
    { branchId: 'b1', quantity: 50, minimumQuantity: 10, branch: CASA },
    { branchId: 'b2', quantity: 2, minimumQuantity: 20, branch: FAENA },
  ],
};

const MOVEMENTS: StockMovement[] = [
  {
    id: 'm1',
    itemId: 'i1',
    branchId: 'b1',
    direction: 'OUT',
    reason: 'TRANSFER',
    quantity: 5,
    resultingBalance: 50,
    reference: 'transfer_1',
    documentNumber: 'GD-9002',
    performedById: 'u1',
    equipmentId: null,
    notes: null,
    occurredAt: '2026-09-12T12:00:00.000Z',
    branch: CASA,
    destinationBranch: FAENA,
  } as StockMovement,
];

function renderFicha(
  { movements = MOVEMENTS, size = 'desktop' as 'phone' | 'desktop' } = {},
) {
  setViewport(size);

  const qc = new QueryClient();
  qc.setQueryData(['branches', { isActive: true }], BRANCHES);
  qc.setQueryData(['inventory', 'kardex', 'i1', null], {
    item: ITEM,
    movements,
  });

  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={['/inventario/i1']}>
        <Routes>
          <Route element={<FichaItemView />} path="/inventario/:id" />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('FichaItemView', () => {
  it('encabeza con qué es el ítem, no solo con su código', () => {
    renderFicha();

    expect(screen.getByText('Aceite hidráulico ISO 68')).toBeTruthy();
    expect(screen.getByText('ACE-002')).toBeTruthy();
    expect(screen.getByText('Suministro')).toBeTruthy();
    expect(screen.getByText('Crítico')).toBeTruthy();
    expect(screen.getByText(/N° parte 1R-0750/)).toBeTruthy();
    expect(screen.getByText(/Lubricantes y fluidos/)).toBeTruthy();
  });

  it('desglosa la existencia por sucursal y suma el total', () => {
    // "No existe un stock global": el total es la suma, y verlo como una fila
    // más deja claro que no es un número propio que pueda discrepar.
    renderFicha();

    const tabla = within(screen.getByLabelText('Existencia por sucursal'));
    expect(tabla.getByText('Casa Matriz')).toBeTruthy();
    expect(tabla.getByText('Faena')).toBeTruthy();
    expect(tabla.getByText('Total empresa')).toBeTruthy();
    expect(tabla.getByText('52 L')).toBeTruthy();
  });

  it('da el estado de cada bodega por separado', () => {
    renderFicha();

    const tabla = within(screen.getByLabelText('Existencia por sucursal'));
    expect(tabla.getByText('OK')).toBeTruthy();
    expect(tabla.getByText('Bajo stock mínimo')).toBeTruthy();
  });

  it('el estado del encabezado toma el peor de las bodegas', () => {
    renderFicha();

    // Casa Matriz sobrada y Faena bajo mínimo: el ítem tiene un problema.
    expect(screen.getAllByText('Bajo stock mínimo').length).toBeGreaterThan(1);
  });

  it('el historial etiqueta el tipo y explica el traspaso', () => {
    // «Kardex» es el término contable; los administradores leen «historial».
    renderFicha();

    const historial = within(screen.getByLabelText('Historial de movimientos'));
    expect(historial.getByText('Traspaso')).toBeTruthy();
    expect(historial.getByText('Traspaso entre sucursales')).toBeTruthy();
    expect(historial.getByText(/hacia Faena/)).toBeTruthy();
    expect(historial.getByText(/GD-9002/)).toBeTruthy();
  });

  it('en teléfono apila las filas en vez de usar tablas', () => {
    renderFicha({ size: 'phone' });

    expect(screen.queryByLabelText('Existencia por sucursal')).toBeNull();
    expect(screen.getByText('Total empresa')).toBeTruthy();
  });

  it('dice cuando el ítem no tiene movimientos', () => {
    renderFicha({ movements: [] });

    expect(
      screen.getByText('Sin movimientos registrados en esta bodega.'),
    ).toBeTruthy();
  });
});
