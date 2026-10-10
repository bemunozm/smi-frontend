import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';

import { WorkshopStockView } from './WorkshopStockView';
import type { InventoryItem } from '../types/inventory';

/** Igual que en `InventarioView.test.tsx`: el listado elige tarjetas o tabla
 * según el ancho, así que cada test declara el que está probando. */
function setViewport(size: 'phone' | 'desktop'): void {
  window.matchMedia = ((query: string) => ({
    matches: size === 'desktop' && query.includes('1280px'),
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
    address: 'Iquique',
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

function item(
  over: Partial<InventoryItem> & Pick<InventoryItem, 'id' | 'sku' | 'name'>,
): InventoryItem {
  return {
    description: null,
    unit: 'UNIT',
    type: 'SUPPLY',
    categoryId: null,
    category: null,
    partNumber: null,
    defaultSupplier: null,
    isCritical: false,
    isActive: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    stocks: [],
    ...over,
  };
}

const OK = item({
  id: 'i1',
  sku: 'FIL-001',
  name: 'Filtro de aceite motor',
  stocks: [{ branchId: 'b1', quantity: 30, minimumQuantity: 10, branch: CASA }],
});

const BAJO = item({
  id: 'i3',
  sku: 'COR-001',
  name: 'Correa de alternador',
  stocks: [{ branchId: 'b2', quantity: 2, minimumQuantity: 5, branch: FAENA }],
});

function renderView(
  items: InventoryItem[],
  { size = 'phone' }: { size?: 'phone' | 'desktop' } = {},
) {
  setViewport(size);

  const qc = new QueryClient();
  qc.setQueryData(['branches', { isActive: true }], BRANCHES);
  qc.setQueryData(['inventory', 'categories', { type: 'SUPPLY' }], []);
  qc.setQueryData(['inventory', 'items', { type: 'SUPPLY', isActive: true }], items);

  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <WorkshopStockView />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('WorkshopStockView', () => {
  it('es el inventario del admin en solo lectura: sin crear, editar, eliminar ni mover stock', () => {
    renderView([OK, BAJO], { size: 'desktop' });

    // Mismas pestañas y filtros que Inventario…
    expect(screen.getByText('Suministros')).toBeTruthy();
    expect(screen.getByText('Repuestos')).toBeTruthy();
    expect(screen.getByLabelText('Filtro de sucursal')).toBeTruthy();
    expect(screen.getByLabelText('Filtro de estado')).toBeTruthy();

    // …pero ninguna puerta de escritura, ni siquiera para ADMIN.
    expect(screen.queryByText('Nuevo ítem')).toBeNull();
    expect(screen.queryByText('Registrar movimiento')).toBeNull();
    expect(screen.queryByRole('button', { name: /Acciones de/ })).toBeNull();
    const tabla = within(screen.getByLabelText('Stock del taller'));
    expect(tabla.queryByText('Acciones')).toBeNull();
  });

  it('explica que los movimientos nacen de las operaciones y enlaza el historial', () => {
    renderView([OK]);

    expect(screen.getByText(/se descuenta automáticamente/)).toBeTruthy();
    const historial = screen.getByRole('link', { name: /Historial de movimientos/ });
    expect(historial.getAttribute('href')).toBe('/inventario/movimientos');
  });

  it('en escritorio muestra la tabla con semáforo y el SKU lleva a la ficha', () => {
    renderView([OK, BAJO], { size: 'desktop' });

    const tabla = within(screen.getByLabelText('Stock del taller'));
    expect(tabla.getByText('Existencia · total')).toBeTruthy();
    expect(tabla.getByText('Bajo stock mínimo')).toBeTruthy();
    const sku = tabla.getByRole('link', { name: 'FIL-001' });
    expect(sku.getAttribute('href')).toBe('/inventario/i1');
  });

  it('en teléfono la tarjeta anuncia la ficha, no una hoja de acciones', () => {
    renderView([OK]);

    expect(screen.getByRole('button', { name: 'Ver ficha de FIL-001' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Acciones de FIL-001' })).toBeNull();
  });

  it('el filtro «Requieren atención» deja solo los ítems con problema', () => {
    renderView([OK, BAJO]);

    expect(screen.getByText(/Requieren atención · 1/)).toBeTruthy();
    fireEvent.click(screen.getByText(/Requieren atención · 1/));

    expect(screen.queryByText('FIL-001')).toBeNull();
    expect(screen.getByText('COR-001')).toBeTruthy();
  });
});
