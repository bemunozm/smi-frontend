import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';

import { InventarioView } from './InventarioView';
import { useUiStore } from '../store/ui';
import type { InventoryItem } from '../types/inventory';

vi.mock('../hooks/useCurrentUser', () => ({
  useCurrentUser: () => ({
    user: {
      id: 'u1',
      name: 'Admin SMI',
      email: 'admin@smi.local',
      role: 'ADMIN',
    },
    role: 'ADMIN',
    isPending: false,
    isAuthenticated: true,
  }),
}));

afterEach(() => {
  cleanup();
  useUiStore.setState({ selectedBranchId: null });
});

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
    type: 'PART',
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

/** Hay saldo acá y con holgura. */
const DISPONIBLE = item({
  id: 'i1',
  sku: 'FIL-001',
  name: 'Filtro de aceite motor',
  stocks: [{ branchId: 'b1', quantity: 30, minimumQuantity: 10, branch: CASA }],
});

/** Hay saldo acá, pero cruzó el mínimo de la bodega. */
const BAJO_MINIMO = item({
  id: 'i2',
  sku: 'COR-001',
  name: 'Correa de alternador',
  stocks: [{ branchId: 'b1', quantity: 2, minimumQuantity: 5, branch: CASA }],
});

/** No hay acá pero sí en la otra bodega: se pide traslado, no compra. */
const EN_OTRA = item({
  id: 'i3',
  sku: 'NEU-001',
  name: 'Neumático 29.5R25',
  stocks: [{ branchId: 'b2', quantity: 2, minimumQuantity: 0, branch: FAENA }],
});

/** No hay en ninguna parte. */
const SIN_STOCK = item({ id: 'i4', sku: 'BAT-001', name: 'Batería 12V' });

const CATEGORIES = [
  {
    id: 'cat1',
    name: 'Filtros',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    _count: { items: 1 },
  },
];

function renderView(items: InventoryItem[]) {
  const qc = new QueryClient();
  qc.setQueryData(['branches', { isActive: true }], BRANCHES);
  qc.setQueryData(['inventory', 'categories'], CATEGORIES);
  qc.setQueryData(
    ['inventory', 'items', { type: 'SUPPLY', isActive: true }],
    items,
  );

  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <InventarioView />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('InventarioView', () => {
  it('renderiza sin reventar', () => {
    // Regresión: `<Tabs.Indicator />` hacía explotar la vista entera con
    // "<SharedElement> must be rendered inside a <SharedElementTransition>".
    // Un test de render la habría atrapado antes de que llegara al navegador.
    expect(() => renderView([DISPONIBLE])).not.toThrow();
    expect(screen.getByText('Suministros')).toBeTruthy();
    expect(screen.getByText('Repuestos')).toBeTruthy();
  });

  it('es una sola pantalla: trae el selector de sucursal y las dos pestañas', () => {
    renderView([DISPONIBLE]);

    // El doble listado (Inventario + Stock por sucursal) mostraba cifras
    // distintas del mismo ítem. Ahora hay una sola vista con la bodega arriba.
    expect(screen.getByText('Sucursal')).toBeTruthy();
    expect(screen.getByText('Stock acá')).toBeTruthy();
    expect(screen.getByText('Total empresa')).toBeTruthy();
  });

  it('distingue los tres estados de disponibilidad', () => {
    renderView([DISPONIBLE, EN_OTRA, SIN_STOCK]);

    // Cada uno lleva a una acción distinta: usar, pedir traslado, comprar. Y
    // el que está en otra bodega la NOMBRA: decir "en otra sucursal" obliga a
    // adivinar a cuál pedirle.
    expect(screen.getAllByText('En esta bodega')).toHaveLength(1);
    expect(screen.getAllByText('En Faena')).toHaveLength(1);
    expect(screen.getAllByText('Sin stock')).toHaveLength(1);
  });

  it('no confunde "quedan pocos" con "no hay"', () => {
    renderView([BAJO_MINIMO]);

    // Quedan 2 y el mínimo es 5: se puede montar hoy, pero hay que reponer.
    expect(screen.getAllByText('En esta bodega')).toHaveLength(1);
    expect(screen.getAllByText('Bajo mínimo')).toHaveLength(1);
  });

  it('muestra la categoría del ítem y la deja vacía como «Sin categoría»', () => {
    // Clasificar sirve para buscar: si la columna no dijera nada cuando falta,
    // un ítem sin categoría parecería un error de carga en vez de un dato que
    // todavía no se llenó.
    renderView([
      item({
        id: 'i5',
        sku: 'FIL-009',
        name: 'Filtro separador',
        categoryId: 'cat1',
        category: { id: 'cat1', name: 'Filtros' },
      }),
      SIN_STOCK,
    ]);

    // Se busca dentro de la tabla: el selector de filtro también nombra las
    // categorías, y contarlas todas juntas no diría nada de las filas.
    const tabla = within(screen.getByLabelText('Inventario'));
    expect(tabla.getAllByText('Filtros')).toHaveLength(1);
    expect(tabla.getAllByText('Sin categoría')).toHaveLength(1);
  });

  it('marca los ítems críticos aunque tengan saldo', () => {
    // Su falta detiene la máquina: el aviso no puede esperar a que el saldo
    // cruce el mínimo.
    renderView([item({ ...DISPONIBLE, isCritical: true })]);

    expect(screen.getByText('Crítico')).toBeTruthy();
  });

  it('le ofrece al administrador editar la ficha', () => {
    // El backend acepta PATCH desde T01, pero hasta ahora no había pantalla:
    // un ítem mal cargado solo se podía borrar y volver a crear.
    renderView([DISPONIBLE]);

    expect(screen.getByRole('button', { name: 'Editar' })).toBeTruthy();
  });

  it('abre los modales con sus campos y sus botones', () => {
    // Regresión: los modales colgaban de `<Table.Body>`, y el colector de
    // react-aria conserva ahí solo filas y celdas — se comía los `TextField` y
    // los `Button` sin avisar. En pantalla salía un modal con título y texto
    // pero sin input ni Guardar, así que el mínimo no se podía cambiar.
    renderView([BAJO_MINIMO]);

    fireEvent.click(screen.getByRole('button', { name: 'Mínimo' }));

    expect(screen.getByLabelText(/Stock mínimo/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Guardar' })).toBeTruthy();
    expect(screen.getByText('Mínimo vigente')).toBeTruthy();
  });

  it('cuenta los ítems bajo el mínimo de la bodega elegida', () => {
    renderView([DISPONIBLE, BAJO_MINIMO, EN_OTRA]);

    // EN_OTRA tiene 0 acá pero sin umbral propio en esta bodega: no alerta.
    expect(screen.getByText('1 bajo el mínimo en Casa Matriz')).toBeTruthy();
  });
});
