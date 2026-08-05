import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

import { InsumoKardexView } from './InsumoKardexView';
import { InventarioView } from './InventarioView';

vi.mock('../hooks/useCurrentUser', () => ({
  useCurrentUser: () => ({
    user: { id: 'u1', name: 'Admin SMI', email: 'admin@smi.local', role: 'ADMIN' },
    role: 'ADMIN',
    isPending: false,
    isAuthenticated: true,
  }),
}));

afterEach(cleanup);

const CON_STOCK = {
  id: 'ins_1',
  codigo: 'ACE-001',
  nombre: 'Aceite motor 15W-40',
  descripcion: null,
  unidad: 'LITRO' as const,
  stock: 220,
  stockMinimo: 200,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

const BAJO_MINIMO = {
  ...CON_STOCK,
  id: 'ins_2',
  codigo: 'NEU-001',
  nombre: 'Neumático 29.5R25',
  unidad: 'UNIDAD' as const,
  stock: 2,
  stockMinimo: 4,
};

describe('InventarioView', () => {
  it('marca con "Stock bajo" solo los insumos en o bajo su mínimo', () => {
    const qc = new QueryClient();
    qc.setQueryData(['inventario', 'insumos', {}], [CON_STOCK, BAJO_MINIMO]);
    qc.setQueryData(['inventario', 'resumen'], { total: 2, bajoMinimo: 1 });
    qc.setQueryData(['equipos'], []);

    render(
      <QueryClientProvider client={qc}>
        <MemoryRouter>
          <InventarioView />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    expect(screen.getByText('Neumático 29.5R25')).toBeTruthy();
    // Un chip "Stock bajo" (NEU-001) y un chip "OK" (ACE-001).
    expect(screen.getAllByText('Stock bajo')).toHaveLength(1);
    expect(screen.getAllByText('OK')).toHaveLength(1);
    expect(screen.getByText('1 bajo el mínimo')).toBeTruthy();
  });

  it('muestra el stock con el símbolo de su unidad', () => {
    const qc = new QueryClient();
    qc.setQueryData(['inventario', 'insumos', {}], [CON_STOCK]);
    qc.setQueryData(['inventario', 'resumen'], { total: 1, bajoMinimo: 0 });
    qc.setQueryData(['equipos'], []);

    render(
      <QueryClientProvider client={qc}>
        <MemoryRouter>
          <InventarioView />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    expect(screen.getByText('220 L')).toBeTruthy();
  });
});

describe('InsumoKardexView', () => {
  it('muestra el saldo que el backend guardó en cada movimiento', () => {
    const qc = new QueryClient();
    qc.setQueryData(['inventario', 'kardex', 'ins_1'], {
      insumo: CON_STOCK,
      movimientos: [
        {
          id: 'mov_2',
          insumoId: 'ins_1',
          tipo: 'SALIDA',
          origen: 'INTERVENCION',
          cantidad: 60,
          saldoResultante: 220,
          responsableId: 'u1',
          equipoId: 'eq_1',
          referenciaId: null,
          observacion: 'Consumo en mantención de EX-001',
          fecha: '2026-08-02T10:00:00.000Z',
          equipo: { id: 'eq_1', codigo: 'EX-001' },
        },
        {
          id: 'mov_1',
          insumoId: 'ins_1',
          tipo: 'ENTRADA',
          origen: 'COMPRA',
          cantidad: 280,
          saldoResultante: 280,
          responsableId: 'u1',
          equipoId: null,
          referenciaId: null,
          observacion: null,
          fecha: '2026-08-01T10:00:00.000Z',
          equipo: null,
        },
      ],
    });

    render(
      <QueryClientProvider client={qc}>
        <MemoryRouter initialEntries={['/inventario/ins_1']}>
          <Routes>
            <Route element={<InsumoKardexView />} path="/inventario/:id" />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );

    expect(screen.getByText('Entrada')).toBeTruthy();
    expect(screen.getByText('Salida')).toBeTruthy();
    // Saldos tal como vienen del backend — la vista no los recalcula.
    expect(screen.getByText('280')).toBeTruthy();
    expect(screen.getByText('EX-001')).toBeTruthy();
  });
});
