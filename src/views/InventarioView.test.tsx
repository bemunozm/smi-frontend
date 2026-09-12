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

/**
 * El listado no esconde una estructura con CSS: elige entre tarjetas y tabla
 * según el ancho. Los tests declaran el ancho que están probando en vez de
 * heredar el `matches: false` del setup.
 */
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

function renderView(
  items: InventoryItem[],
  size: 'phone' | 'desktop' = 'phone',
) {
  setViewport(size);

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

/** Abre el panel de acciones del ítem tocando su tarjeta. */
function openActions(sku: string): void {
  fireEvent.click(screen.getByRole('button', { name: `Acciones de ${sku}` }));
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
    // El doble listado (Inventario + Stock por sucursal) mostraba cifras
    // distintas del mismo ítem. Ahora hay una sola vista con la bodega arriba.
    renderView([DISPONIBLE]);

    expect(screen.getByText('Sucursal')).toBeTruthy();
    expect(screen.getByText('Categoría')).toBeTruthy();
  });

  describe('según el ancho de pantalla', () => {
    it('en teléfono y tablet muestra tarjetas, no una tabla', () => {
      // En faena usan el teléfono: una tabla de ocho columnas ahí obliga a
      // desplazarse en horizontal para leer una sola fila.
      renderView([DISPONIBLE], 'phone');

      expect(screen.queryByLabelText('Inventario')).toBeNull();
      expect(
        screen.getByRole('button', { name: 'Acciones de FIL-001' }),
      ).toBeTruthy();
    });

    it('en escritorio muestra la tabla con sus columnas', () => {
      renderView([DISPONIBLE], 'desktop');

      const tabla = within(screen.getByLabelText('Inventario'));
      expect(tabla.getByText('Stock acá')).toBeTruthy();
      expect(tabla.getByText('Total empresa')).toBeTruthy();
    });

    it('en escritorio conserva el atajo de cantidad con + y −', () => {
      // Frente al PC el bodeguero escribe un número y aprieta dos veces; el
      // panel de acciones es para todo lo demás.
      renderView([DISPONIBLE], 'desktop');

      expect(screen.getByLabelText('Cantidad para FIL-001')).toBeTruthy();
      expect(
        screen.getByRole('button', { name: 'Registrar recepción de FIL-001' }),
      ).toBeTruthy();
      expect(
        screen.getByRole('button', { name: 'Registrar consumo de FIL-001' }),
      ).toBeTruthy();
    });

    it('no monta las dos estructuras a la vez', () => {
      // Montar tabla y tarjetas para tapar una con `hidden` duplica cada ítem
      // en el DOM y se lo hace leer dos veces a un lector de pantalla.
      renderView([DISPONIBLE], 'desktop');

      expect(
        screen.queryByRole('button', { name: 'Acciones de FIL-001' }),
      ).toBeNull();
    });
  });

  it('distingue los tres estados de disponibilidad', () => {
    renderView([DISPONIBLE, EN_OTRA, SIN_STOCK]);

    // Cada uno lleva a una acción distinta: usar, pedir traslado, comprar. Y
    // el que está en otra bodega la NOMBRA: decir "en otra sucursal" obliga a
    // adivinar a cuál pedirle.
    expect(screen.getAllByText('OK')).toHaveLength(1);
    expect(screen.getAllByText('En Faena')).toHaveLength(1);
    expect(screen.getAllByText('Sin stock')).toHaveLength(1);
  });

  it('no confunde "quedan pocos" con "no hay"', () => {
    renderView([BAJO_MINIMO]);

    // Quedan 2 y el mínimo es 5: se puede montar hoy, pero hay que reponer.
    // Es UN rótulo, no dos: antes convivían 'En esta bodega' y 'Bajo mínimo'
    // y el verde del primero suavizaba la alerta del segundo.
    expect(screen.queryByText('OK')).toBeNull();
    expect(screen.getAllByText('Bajo stock mínimo')).toHaveLength(1);
  });

  it('marca los ítems críticos aunque tengan saldo', () => {
    // Su falta detiene la máquina: el aviso no puede esperar a que el saldo
    // cruce el mínimo.
    renderView([item({ ...DISPONIBLE, isCritical: true })]);

    expect(screen.getByText('Crítico')).toBeTruthy();
  });

  it('muestra la categoría del ítem en la tabla y la vacía como «Sin categoría»', () => {
    // Clasificar sirve para buscar: si la columna no dijera nada cuando falta,
    // un ítem sin categoría parecería un error de carga en vez de un dato que
    // todavía no se llenó.
    renderView(
      [
        item({
          id: 'i5',
          sku: 'FIL-009',
          name: 'Filtro separador',
          categoryId: 'cat1',
          category: { id: 'cat1', name: 'Filtros' },
        }),
        SIN_STOCK,
      ],
      'desktop',
    );

    // Se busca dentro de la tabla: el selector de filtro también nombra las
    // categorías, y contarlas todas juntas no diría nada de las filas.
    const tabla = within(screen.getByLabelText('Inventario'));
    expect(tabla.getAllByText('Filtros')).toHaveLength(1);
    expect(tabla.getAllByText('Sin categoría')).toHaveLength(1);
  });

  it('cuenta los ítems bajo el mínimo de la bodega elegida', () => {
    renderView([DISPONIBLE, BAJO_MINIMO, EN_OTRA]);

    // EN_OTRA tiene 0 acá pero sin umbral propio en esta bodega: no alerta.
    expect(screen.getByText('Bajo mínimo · 1')).toBeTruthy();
    expect(screen.getByText('Todos · 3')).toBeTruthy();
  });

  describe('panel de acciones', () => {
    it('reúne las acciones del ítem en un solo lugar', () => {
      // Antes eran seis enlaces sueltos en una columna: en el teléfono no hay
      // columna donde ponerlos, y en escritorio obligaban a leerlos todos.
      renderView([BAJO_MINIMO]);
      openActions('COR-001');

      expect(screen.getByText('Acciones rápidas')).toBeTruthy();
      expect(
        screen.getByRole('button', { name: /Registrar movimiento/ }),
      ).toBeTruthy();
      expect(
        screen.getByRole('button', { name: /Traspasar a otra sucursal/ }),
      ).toBeTruthy();
      expect(screen.getByRole('button', { name: /Editar ítem/ })).toBeTruthy();
    });

    it('abre cada acción con sus campos y sus botones', () => {
      // Regresión: los modales colgaban de `<Table.Body>`, y el colector de
      // react-aria conserva ahí solo filas y celdas — se comía los `TextField`
      // y los `Button` sin avisar. Salía un modal con título y texto pero sin
      // input ni Guardar, así que el mínimo no se podía cambiar.
      renderView([BAJO_MINIMO]);
      openActions('COR-001');

      fireEvent.click(screen.getByRole('button', { name: /Stock mínimo/ }));

      expect(screen.getByLabelText(/Stock mínimo/)).toBeTruthy();
      expect(screen.getByRole('button', { name: 'Guardar' })).toBeTruthy();
      expect(screen.getByText('Mínimo vigente')).toBeTruthy();
    });

    it('pide el documento aparte de la observación', () => {
      // Por la guía se busca, por la nota se lee. Mezcladas en un solo campo,
      // el número de guía deja de ser encontrable.
      renderView([BAJO_MINIMO]);
      openActions('COR-001');

      fireEvent.click(
        screen.getByRole('button', { name: /Registrar movimiento/ }),
      );

      expect(screen.getByLabelText('Documento (opcional)')).toBeTruthy();
      expect(screen.getByLabelText('Observación (opcional)')).toBeTruthy();
      expect(screen.getByLabelText('Motivo')).toBeTruthy();
    });

    it('avisa antes de traspasar más de lo que hay', () => {
      // Mover material entre faenas es lo más caro de deshacer: hay que
      // traerlo de vuelta.
      renderView([BAJO_MINIMO]);
      openActions('COR-001');

      fireEvent.click(
        screen.getByRole('button', { name: /Traspasar a otra sucursal/ }),
      );
      fireEvent.change(screen.getByLabelText(/Cantidad/), {
        target: { value: '9' },
      });

      expect(screen.getByText(/no alcanza para mover/)).toBeTruthy();
      expect(
        screen
          .getByRole('button', { name: 'Confirmar traspaso' })
          .hasAttribute('disabled'),
      ).toBe(true);
    });
  });
});
