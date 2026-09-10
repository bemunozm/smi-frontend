import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';

import { StockSucursalView } from './StockSucursalView';

vi.mock('../hooks/useCurrentUser', () => ({
  useCurrentUser: () => ({
    user: {
      id: 'u1',
      name: 'Mantenedor SMI',
      email: 'mantenedor@smi.local',
      role: 'MANTENEDOR',
    },
    role: 'MANTENEDOR',
    isPending: false,
    isAuthenticated: true,
  }),
}));

afterEach(cleanup);

const SUCURSALES = [
  {
    id: 'suc_1',
    codigo: 'CENTRAL',
    nombre: 'Casa Matriz',
    direccion: null,
    activa: true,
    esPrincipal: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
];

const BASE = {
  descripcion: null,
  unidad: 'UNIDAD' as const,
  tipo: 'REPUESTO' as const,
};

/** Hay 30 acá y 30 en total: alcanza, no hay nada que hacer. */
const DISPONIBLE = {
  ...BASE,
  insumoId: 'ins_1',
  codigo: 'FIL-001',
  nombre: 'Filtro de aceite motor',
  stock: 30,
  stockTotal: 30,
  stockMinimo: 10,
  enBodega: true,
  bajoMinimo: false,
};

/** No hay acá, pero la empresa tiene: se pide un traslado, no una compra. */
const EN_OTRA = {
  ...BASE,
  insumoId: 'ins_2',
  codigo: 'NEU-001',
  nombre: 'Neumático 29.5R25',
  stock: 0,
  stockTotal: 2,
  stockMinimo: 4,
  enBodega: false,
  bajoMinimo: true,
};

/** No hay en ninguna parte: hay que comprar. */
const SIN_STOCK = {
  ...BASE,
  insumoId: 'ins_3',
  codigo: 'BAT-001',
  nombre: 'Batería 12V 180Ah',
  stock: 0,
  stockTotal: 0,
  stockMinimo: 2,
  enBodega: true,
  bajoMinimo: true,
};

function renderView(items: unknown[]) {
  const qc = new QueryClient();
  qc.setQueryData(['sucursales', { activa: true }], SUCURSALES);
  qc.setQueryData(['inventario', 'stock', { sucursalId: 'suc_1' }], {
    sucursalId: 'suc_1',
    items,
  });

  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <StockSucursalView />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('StockSucursalView', () => {
  it('distingue "no hay acá pero sí en otra sucursal" de "no hay en ninguna parte"', () => {
    renderView([DISPONIBLE, EN_OTRA, SIN_STOCK]);

    // Es la distinción que justifica la pantalla: los tres estados llevan a
    // acciones distintas (usar / pedir traslado / comprar). Colapsarlos en
    // "ok / no ok" devolvería el problema que PROD-11 vino a resolver.
    expect(screen.getAllByText('En esta bodega')).toHaveLength(1);
    expect(screen.getAllByText('En otra sucursal')).toHaveLength(1);
    expect(screen.getAllByText('Sin stock')).toHaveLength(1);
  });

  it('muestra el saldo de la bodega junto al total de la empresa', () => {
    renderView([EN_OTRA]);

    // 0 acá, 2 en la empresa. Ver solo el total (2) habría hecho creer al
    // mantenedor que tiene el neumático a mano.
    expect(screen.getByText('0 u')).toBeTruthy();
    expect(screen.getByText('2')).toBeTruthy();
  });

  it('resume cuántos ítems están bajo el mínimo en esta bodega', () => {
    renderView([DISPONIBLE, EN_OTRA, SIN_STOCK]);

    expect(screen.getByText('3 ítems')).toBeTruthy();
    expect(screen.getByText('2 bajo el mínimo acá')).toBeTruthy();
    expect(screen.getByText('1 disponibles en otra sucursal')).toBeTruthy();
  });

  it('muestra el vacío con contexto cuando la bodega no tiene coincidencias', () => {
    renderView([]);

    expect(screen.getByText('No hay ítems que coincidan')).toBeTruthy();
  });
});
