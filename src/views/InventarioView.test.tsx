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
    compatibilities: [],
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

function renderView(
  items: InventoryItem[],
  {
    size = 'phone',
    branchId,
    url = '/',
  }: { size?: 'phone' | 'desktop'; branchId?: string; url?: string } = {},
) {
  setViewport(size);
  if (branchId) useUiStore.setState({ selectedBranchId: branchId });

  const qc = new QueryClient();
  qc.setQueryData(['branches', { isActive: true }], BRANCHES);
  qc.setQueryData(['equipment'], []);
  qc.setQueryData(
    ['inventory', 'items', { isActive: true }],
    items,
  );

  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[url]}>
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
    expect(screen.getByRole('tab', { name: 'Suministros' })).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'Repuestos' })).toBeTruthy();
  });

  describe('inventario general', () => {
    it('parte mostrando toda la empresa, no una sucursal', () => {
      // Con dos faenas la pregunta de entrada es "¿cuánto hay?", y recién
      // después "¿en cuál?". Elegir sucursal es un filtro, no el punto de
      // partida.
      renderView([OK, SOLO_FAENA], { size: 'desktop' });

      const tabla = within(screen.getByLabelText('Inventario'));
      expect(tabla.getByText('Existencia · total')).toBeTruthy();
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
      expect(tabla.getByText('Existencia acá')).toBeTruthy();
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

  describe('sin pestañas: tipo, categorías y equipos a la vista', () => {
    const ACEITE = { id: 'cat-ace', name: 'Aceite' };
    const FILTRO = { id: 'cat-fil', name: 'Filtro' };
    const eq = (equipmentId: string, internalCode: string) => ({ equipmentId, internalCode, note: null });

    const ACE = item({
      id: 'a1',
      sku: 'ACE-100',
      name: 'Aceite hidráulico',
      type: 'SUPPLY',
      categoryId: ACEITE.id,
      category: ACEITE,
      stocks: [{ branchId: 'b1', quantity: 40, minimumQuantity: 10, branch: CASA }],
      compatibilities: [eq('e1', 'EXC-01')],
    });
    const FIL = item({
      id: 'f1',
      sku: 'FIL-100',
      name: 'Filtro de aire',
      type: 'PART',
      categoryId: FILTRO.id,
      category: FILTRO,
      stocks: [{ branchId: 'b1', quantity: 5, minimumQuantity: 2, branch: CASA }],
      compatibilities: [eq('e1', 'EXC-01'), eq('e2', 'CAM-02'), eq('e3', 'CAR-03')],
    });
    const SUELTO = item({
      id: 's1',
      sku: 'SUE-100',
      name: 'Cinta',
      type: 'SUPPLY',
      stocks: [{ branchId: 'b1', quantity: 9, minimumQuantity: 0, branch: CASA }],
    });

    const tablaInventario = () => within(screen.getByLabelText('Inventario'));
    const skusEnOrden = () =>
      tablaInventario()
        .getAllByRole('row')
        .slice(1)
        .map((row) => (row.textContent ?? '').slice(0, 7));

    it('muestra todos los ítems juntos, con un filtro compacto de tipo y sin las pestañas de antes', () => {
      renderView([ACE, FIL, SUELTO], { size: 'desktop' });

      expect(tablaInventario().getByText('ACE-100')).toBeTruthy();
      expect(tablaInventario().getByText('FIL-100')).toBeTruthy();
      expect(screen.getByRole('tablist', { name: 'Filtro de tipo' })).toBeTruthy();
      expect(screen.queryByRole('tablist', { name: 'Tipo de ítem' })).toBeNull();
    });

    it('las categorías son pastillas con su conteo y filtran con un toque', () => {
      renderView([ACE, FIL, SUELTO], { size: 'desktop' });

      const grupo = within(screen.getByRole('group', { name: 'Filtro de categoría' }));
      expect(grupo.getByRole('button', { name: /Todas\s*3/ })).toBeTruthy();
      expect(grupo.getByRole('button', { name: /Aceite\s*1/ })).toBeTruthy();
      expect(grupo.getByRole('button', { name: /Sin categoría\s*1/ })).toBeTruthy();

      fireEvent.click(grupo.getByRole('button', { name: /Filtro\s*1/ }));

      expect(tablaInventario().getByText('FIL-100')).toBeTruthy();
      expect(tablaInventario().queryByText('ACE-100')).toBeNull();
      expect(grupo.getByRole('button', { name: /Filtro\s*1/ }).getAttribute('aria-pressed')).toBe('true');

      fireEvent.click(grupo.getByRole('button', { name: /Todas/ }));
      expect(tablaInventario().getByText('ACE-100')).toBeTruthy();
    });

    it('el filtro de tipo deja solo repuestos y recalcula las pastillas', () => {
      renderView([ACE, FIL, SUELTO], { size: 'desktop' });

      fireEvent.click(screen.getByRole('tab', { name: 'Repuestos' }));

      expect(tablaInventario().getByText('FIL-100')).toBeTruthy();
      expect(tablaInventario().queryByText('ACE-100')).toBeNull();
      const grupo = within(screen.getByRole('group', { name: 'Filtro de categoría' }));
      expect(grupo.queryByRole('button', { name: /Aceite/ })).toBeNull();
    });

    it('columna Equipos: un equipo = su código; varios = «Varios · N» con el detalle; ninguno = «—»', () => {
      renderView([ACE, FIL, SUELTO], { size: 'desktop' });

      expect(tablaInventario().getByText('EXC-01')).toBeTruthy();
      expect(tablaInventario().getByRole('button', { name: 'Ver los 3 equipos: EXC-01, CAM-02, CAR-03' })).toBeTruthy();
      expect(tablaInventario().getAllByText('—').length).toBeGreaterThan(0);
    });

    it('ordena por Equipos: un solo equipo, luego «Varios» y los vacíos siempre al final', () => {
      renderView([SUELTO, FIL, ACE], { size: 'desktop' });

      fireEvent.click(tablaInventario().getByText('Equipos'));
      expect(skusEnOrden()).toEqual(['ACE-100', 'FIL-100', 'SUE-100']);

      fireEvent.click(tablaInventario().getByText('Equipos'));
      expect(skusEnOrden()).toEqual(['FIL-100', 'ACE-100', 'SUE-100']);
    });

    it('ordena por Existencia como número y por SKU', () => {
      renderView([ACE, FIL, SUELTO], { size: 'desktop' });

      fireEvent.click(tablaInventario().getByText('Existencia · total'));
      expect(skusEnOrden()).toEqual(['FIL-100', 'SUE-100', 'ACE-100']);

      fireEvent.click(tablaInventario().getByText('SKU'));
      expect(skusEnOrden()).toEqual(['ACE-100', 'FIL-100', 'SUE-100']);
    });

    it('en el celular ofrece «Ordenar por» con las mismas columnas', () => {
      renderView([ACE, FIL, SUELTO], { size: 'phone' });

      const selector = screen.getByTestId('orden-columna');
      expect(within(selector).getByText('Equipos')).toBeTruthy();
      expect(within(selector).getByText('Tipo')).toBeTruthy();
      fireEvent.change(selector, { target: { value: 'existencia' } });
      fireEvent.click(screen.getByTestId('orden-direccion'));
      const etiquetas = screen
        .getAllByRole('button', { name: /^Acciones de / })
        .map((boton) => boton.getAttribute('aria-label'));
      expect(etiquetas).toEqual(['Acciones de ACE-100', 'Acciones de SUE-100', 'Acciones de FIL-100']);
    });
  });

  describe('filtro desde la URL', () => {
    it('?filtro=bajo-minimo parte en «Requieren atención» y oculta lo que está OK', () => {
      renderView([OK, RIESGO, BAJO], { size: 'desktop', branchId: 'b1', url: '/inventario?filtro=bajo-minimo' });

      const tabla = within(screen.getByLabelText('Inventario'));
      expect(tabla.queryByText('FIL-001')).toBeNull();
      expect(tabla.getByText('COR-001')).toBeTruthy();
    });

    it('sin el parámetro parte en «Todos»', () => {
      renderView([OK, RIESGO, BAJO], { size: 'desktop', branchId: 'b1' });

      expect(within(screen.getByLabelText('Inventario')).getByText('FIL-001')).toBeTruthy();
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
      expect(screen.getByText('Requieren atención · 2')).toBeTruthy();
      expect(screen.getByText('Todos · 3')).toBeTruthy();
    });

    it('marca los ítems críticos aparte del estado', () => {
      renderView([item({ ...OK, isCritical: true })], { branchId: 'b1' });

      expect(screen.getByText('Crítico')).toBeTruthy();
      expect(screen.getByText('OK')).toBeTruthy();
    });

    it('pone los ítems críticos arriba, sin desordenar el resto', () => {
      const critico = item({ ...SIN_STOCK, isCritical: true });
      renderView([OK, RIESGO, critico, BAJO], { size: 'desktop' });

      const filas = within(screen.getByLabelText('Inventario')).getAllByRole('row').slice(1);
      const skus = filas.map((fila) => within(fila).getByRole('link').textContent);
      expect(skus).toEqual(['BAT-001', 'FIL-001', 'ACE-001', 'COR-001']);
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
      // Montar tabla y tarjetas para tapar una con `hidden` duplica cada ítem
      // en el DOM y se lo hace leer dos veces a un lector de pantalla.
      renderView([OK], { size: 'desktop' });

      expect(screen.getAllByText('FIL-001')).toHaveLength(1);
    });
  });

  describe('acciones', () => {
    it('en escritorio las guarda detrás de los tres puntos', () => {
      // Cuatro iconos por fila son ochenta objetos en una tabla de veinte
      // filas; detrás del menú las acciones tienen nombre escrito.
      renderView([OK], { size: 'desktop' });

      expect(screen.queryByText('Editar ítem')).toBeNull();

      fireEvent.click(
        screen.getByRole('button', { name: 'Acciones de FIL-001' }),
      );

      // Se busca dentro del menú: «Registrar movimiento» también es un botón
      // de la cabecera, para el que llega con la guía y todavía no eligió ítem.
      const menu = within(screen.getByRole('menu'));
      for (const label of [
        'Editar ítem',
        'Registrar movimiento',
        'Ver ficha',
        'Dar de baja',
        'Eliminar ítem',
      ]) {
        expect(menu.getByText(label)).toBeTruthy();
      }
    });

    it('quien puede dar de baja ve el interruptor «Mostrar dados de baja»', () => {
      renderView([OK], { size: 'desktop' });

      expect(screen.getByText('Mostrar dados de baja')).toBeTruthy();
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
