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
 * según el ancho. Los tests declaran el ancho que están probando.
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

/** 30 con un mínimo de 10: holgura de sobra. */
const OK = item({
  id: 'i1',
  sku: 'FIL-001',
  name: 'Filtro de aceite motor',
  stocks: [{ branchId: 'b1', quantity: 30, minimumQuantity: 10, branch: CASA }],
});

/** 12 con un mínimo de 10: todavía no lo cruza, pero le queda poco. */
const RIESGO = item({
  id: 'i2',
  sku: 'ACE-001',
  name: 'Aceite motor 15W-40',
  stocks: [{ branchId: 'b1', quantity: 12, minimumQuantity: 10, branch: CASA }],
});

/** 2 con un mínimo de 5: hay que reponer ya. */
const BAJO = item({
  id: 'i3',
  sku: 'COR-001',
  name: 'Correa de alternador',
  stocks: [{ branchId: 'b1', quantity: 2, minimumQuantity: 5, branch: CASA }],
});

/** Solo hay en Faena. */
const SOLO_FAENA = item({
  id: 'i4',
  sku: 'NEU-001',
  name: 'Neumático 29.5R25',
  stocks: [{ branchId: 'b2', quantity: 6, minimumQuantity: 0, branch: FAENA }],
});

/** No hay en ninguna parte. */
const SIN_STOCK = item({ id: 'i5', sku: 'BAT-001', name: 'Batería 12V' });

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
  {
    size = 'phone',
    branchId,
  }: { size?: 'phone' | 'desktop'; branchId?: string } = {},
) {
  setViewport(size);
  if (branchId) useUiStore.setState({ selectedBranchId: branchId });

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

function openActions(sku: string): void {
  fireEvent.click(screen.getByRole('button', { name: `Acciones de ${sku}` }));
}

describe('InventarioView', () => {
  it('renderiza sin reventar', () => {
    expect(() => renderView([OK])).not.toThrow();
    expect(screen.getByText('Suministros')).toBeTruthy();
    expect(screen.getByText('Repuestos')).toBeTruthy();
  });

  describe('inventario general', () => {
    it('parte mostrando toda la empresa, no una sucursal', () => {
      // Con dos faenas la pregunta de entrada es "¿cuánto hay?", y recién
      // después "¿en cuál?". Elegir sucursal es un filtro, no el punto de
      // partida.
      renderView([OK, SOLO_FAENA], { size: 'desktop' });

      const tabla = within(screen.getByLabelText('Inventario'));
      expect(tabla.getByText('Stock total')).toBeTruthy();
      // Los dos ítems se ven aunque estén en bodegas distintas.
      expect(tabla.getByText('FIL-001')).toBeTruthy();
      expect(tabla.getByText('NEU-001')).toBeTruthy();
    });

    it('dice en qué sucursal está cada ítem', () => {
      renderView([OK, SOLO_FAENA], { size: 'desktop' });

      const tabla = within(screen.getByLabelText('Inventario'));
      expect(tabla.getByText('Sucursal')).toBeTruthy();
      expect(tabla.getByText('Casa Matriz')).toBeTruthy();
      expect(tabla.getByText('Faena')).toBeTruthy();
    });

    it('al filtrar por sucursal muestra el saldo de esa bodega y su mínimo', () => {
      renderView([OK], { size: 'desktop', branchId: 'b1' });

      const tabla = within(screen.getByLabelText('Inventario'));
      expect(tabla.getByText('Stock acá')).toBeTruthy();
      expect(tabla.getByText('Mínimo')).toBeTruthy();
    });

    it('toma el PEOR estado de las sucursales, no el promedio', () => {
      // Si una faena está bajo mínimo y la otra sobrada, el ítem tiene un
      // problema; promediarlo lo escondería detrás de un verde.
      const enDos = item({
        id: 'i9',
        sku: 'GRA-001',
        name: 'Grasa EP-2',
        stocks: [
          { branchId: 'b1', quantity: 90, minimumQuantity: 10, branch: CASA },
          { branchId: 'b2', quantity: 1, minimumQuantity: 5, branch: FAENA },
        ],
      });

      renderView([enDos]);

      expect(screen.getByText('Bajo stock mínimo')).toBeTruthy();
      expect(screen.queryByText('OK')).toBeNull();
    });
  });

  describe('estados de existencia', () => {
    it('distingue OK, riesgo y peligro', () => {
      renderView([OK, RIESGO, BAJO, SIN_STOCK], { branchId: 'b1' });

      expect(screen.getAllByText('OK')).toHaveLength(1);
      expect(screen.getAllByText('Riesgo de stock bajo')).toHaveLength(1);
      expect(screen.getAllByText('Bajo stock mínimo')).toHaveLength(1);
      expect(screen.getAllByText('Sin stock')).toHaveLength(1);
    });

    it('sin mínimo fijado solo distingue "hay" de "no hay"', () => {
      // `minimumQuantity = 0` es "esta bodega no fijó umbral": no hay contra
      // qué medir la holgura, así que no puede haber riesgo.
      renderView([SOLO_FAENA], { branchId: 'b2' });

      expect(screen.getByText('OK')).toBeTruthy();
    });

    it('cuenta los ítems con alerta', () => {
      renderView([OK, RIESGO, BAJO], { branchId: 'b1' });

      // Ámbar y rojo se cuentan juntos: los dos piden una decisión de compra.
      expect(screen.getByText('Con alerta · 2')).toBeTruthy();
      expect(screen.getByText('Todos · 3')).toBeTruthy();
    });

    it('marca los ítems críticos aparte del estado', () => {
      renderView([item({ ...OK, isCritical: true })], { branchId: 'b1' });

      expect(screen.getByText('Crítico')).toBeTruthy();
      expect(screen.getByText('OK')).toBeTruthy();
    });
  });

  describe('según el ancho de pantalla', () => {
    it('en teléfono y tablet muestra tarjetas, no una tabla', () => {
      renderView([OK], { size: 'phone' });

      expect(screen.queryByLabelText('Inventario')).toBeNull();
      expect(
        screen.getByRole('button', { name: 'Acciones de FIL-001' }),
      ).toBeTruthy();
    });

    it('no monta las dos estructuras a la vez', () => {
      renderView([OK], { size: 'desktop' });

      expect(
        screen.queryByRole('button', { name: 'Acciones de FIL-001' }),
      ).toBeNull();
    });
  });

  describe('acciones', () => {
    it('la fila de escritorio trae las cuatro y nada más', () => {
      renderView([OK], { size: 'desktop' });

      for (const label of [
        'Editar ítem',
        'Registrar movimiento',
        'Ver ficha',
        'Eliminar ítem',
      ]) {
        expect(screen.getByRole('button', { name: label })).toBeTruthy();
      }
      // El atajo de cantidad con `+`/`−` se retiró: todo movimiento pasa por
      // el formulario, que pide motivo y documento.
      expect(screen.queryByLabelText('Cantidad para FIL-001')).toBeNull();
    });

    it('en teléfono las cuatro viven en el panel de la tarjeta', () => {
      renderView([OK]);
      openActions('FIL-001');

      expect(screen.getByText('Acciones')).toBeTruthy();
      expect(
        screen.getByRole('button', { name: /Registrar movimiento/ }),
      ).toBeTruthy();
      expect(screen.getByRole('button', { name: /Ver ficha/ })).toBeTruthy();
    });
  });

  describe('formulario de movimiento', () => {
    function openMovement(): void {
      renderView([BAJO], { branchId: 'b1' });
      openActions('COR-001');
      fireEvent.click(
        screen.getByRole('button', { name: /Registrar movimiento/ }),
      );
    }

    it('reúne entrada, salida, traspaso y conteo en un solo formulario', () => {
      // Las cuatro responden a la misma pregunta ("¿cuánto y en qué bodega?");
      // separarlas obligaba a saber de antemano cuál era la correcta.
      openMovement();

      for (const label of ['Entrada', 'Salida', 'Traspaso', 'Conteo']) {
        expect(screen.getByRole('tab', { name: label })).toBeTruthy();
      }
    });

    it('pide motivo, documento y observación', () => {
      openMovement();

      expect(screen.getByLabelText('Motivo / origen')).toBeTruthy();
      expect(screen.getByLabelText('Documento (opcional)')).toBeTruthy();
      expect(screen.getByLabelText('Observación (opcional)')).toBeTruthy();
    });

    it('pide destino al traspasar y avisa si no alcanza', () => {
      openMovement();
      fireEvent.click(screen.getByRole('tab', { name: 'Traspaso' }));

      expect(screen.getByLabelText('Sucursal de destino')).toBeTruthy();

      fireEvent.change(screen.getByLabelText(/Cantidad/), {
        target: { value: '9' },
      });

      expect(screen.getByText(/no alcanza para mover/)).toBeTruthy();
      expect(
        screen.getByRole('button', { name: 'Registrar' }).hasAttribute('disabled'),
      ).toBe(true);
    });

    it('el conteo parte con lo que el sistema tiene y muestra la diferencia', () => {
      openMovement();
      fireEvent.click(screen.getByRole('tab', { name: 'Conteo' }));

      const campo = screen.getByLabelText(/Stock contado/);
      expect((campo as HTMLInputElement).value).toBe('2');

      fireEvent.change(campo, { target: { value: '5' } });
      expect(screen.getByText('Diferencia: +3 u')).toBeTruthy();
    });
  });
});
