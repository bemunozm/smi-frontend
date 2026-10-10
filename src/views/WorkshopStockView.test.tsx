import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
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

function branch(base: { id: string; name: string }, address: string | null = null) {
  return {
    ...base,
    address,
    isActive: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
}

const BRANCHES = [branch(CASA, 'Iquique'), branch(FAENA)];

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

/** Con stock en LAS DOS bodegas: la vista solo puede hablar de Faena. */
const EN_AMBAS = item({
  id: 'i1',
  sku: 'FIL-001',
  name: 'Filtro de aceite motor',
  stocks: [
    { branchId: 'b1', quantity: 30, minimumQuantity: 10, branch: CASA },
    { branchId: 'b2', quantity: 7, minimumQuantity: 4, branch: FAENA },
  ],
});

const BAJO_EN_FAENA = item({
  id: 'i3',
  sku: 'COR-001',
  name: 'Correa de alternador',
  stocks: [{ branchId: 'b2', quantity: 2, minimumQuantity: 5, branch: FAENA }],
});

function renderView(
  items: InventoryItem[],
  {
    size = 'phone',
    branches = BRANCHES,
  }: { size?: 'phone' | 'desktop'; branches?: typeof BRANCHES } = {},
) {
  setViewport(size);

  const qc = new QueryClient();
  qc.setQueryData(['branches', { isActive: true }], branches);
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
    renderView([EN_AMBAS, BAJO_EN_FAENA], { size: 'desktop' });

    // Mismas pestañas y búsqueda que Inventario…
    expect(screen.getByText('Suministros')).toBeTruthy();
    expect(screen.getByText('Repuestos')).toBeTruthy();
    expect(screen.getByLabelText('Buscar ítem')).toBeTruthy();

    // …pero ninguna puerta de escritura, ni siquiera para ADMIN.
    expect(screen.queryByText('Nuevo ítem')).toBeNull();
    expect(screen.queryByText('Registrar movimiento')).toBeNull();
    expect(screen.queryByRole('button', { name: /Acciones de/ })).toBeNull();
    const tabla = within(screen.getByLabelText('Stock del taller'));
    expect(tabla.queryByText('Acciones')).toBeNull();
  });

  it('no ofrece filtro de sucursal ni de estado: la bodega del taller es Faena y se ve todo', () => {
    renderView([EN_AMBAS, BAJO_EN_FAENA], { size: 'desktop' });

    expect(screen.queryByLabelText('Filtro de sucursal')).toBeNull();
    expect(screen.queryByText('Sucursal')).toBeNull();
    expect(screen.queryByLabelText('Filtro de estado')).toBeNull();
    expect(screen.queryByText(/Requieren atención/)).toBeNull();
    expect(screen.getAllByText(/en Faena/).length).toBeGreaterThan(0);
  });

  it('muestra SOLO la existencia de Faena, nunca la de otras bodegas', () => {
    renderView([EN_AMBAS], { size: 'desktop' });

    const tabla = within(screen.getByLabelText('Stock del taller'));
    expect(tabla.getByText('Existencia en Faena')).toBeTruthy();
    // 7 en Faena — el 30 de Casa Matriz no aparece en ninguna parte.
    expect(tabla.getByText(/^7/)).toBeTruthy();
    expect(screen.queryByText(/30/)).toBeNull();
    expect(screen.queryByText('Casa Matriz')).toBeNull();
  });

  it('sin bodega de faena activa lo dice, en vez de inventar un total', () => {
    renderView([EN_AMBAS], { branches: [branch(CASA, 'Iquique')] });

    expect(screen.getByRole('alert').textContent).toContain('bodega de faena');
    expect(screen.queryByText('FIL-001')).toBeNull();
  });

  it('explica que los movimientos nacen de las operaciones y enlaza el historial SIN salir del taller', () => {
    renderView([EN_AMBAS]);

    expect(screen.getByText(/se descuenta automáticamente/)).toBeTruthy();
    // La ruta vive dentro del shell de Mantención: la barra del módulo no cambia.
    const historial = screen.getByRole('link', { name: /Historial de movimientos/ });
    expect(historial.getAttribute('href')).toBe('/mantenimiento/stock/movimientos');
  });

  it('en escritorio el SKU lleva a la ficha; en teléfono la tarjeta anuncia la ficha', () => {
    renderView([BAJO_EN_FAENA], { size: 'desktop' });
    const sku = within(screen.getByLabelText('Stock del taller')).getByRole('link', {
      name: 'COR-001',
    });
    expect(sku.getAttribute('href')).toBe('/inventario/i3');
    cleanup();

    renderView([BAJO_EN_FAENA], { size: 'phone' });
    expect(screen.getByRole('button', { name: 'Ver ficha de COR-001' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Acciones de COR-001' })).toBeNull();
  });
});
