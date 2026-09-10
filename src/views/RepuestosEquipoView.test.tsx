import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

import { RepuestosEquipoView } from './RepuestosEquipoView';

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

const EQUIPO = {
  id: 'eq_1',
  codigo: 'EX-001',
  tipo: 'Excavadora',
  marca: 'Caterpillar',
  modelo: '336',
  estado: 'DISPONIBLE' as const,
};

const BASE = {
  descripcion: null,
  unidad: 'UNIDAD' as const,
  tipo: 'REPUESTO' as const,
  nota: null,
};

/** Lo tengo acá y con holgura. */
const EN_BODEGA = {
  ...BASE,
  compatibilidadId: 'comp_1',
  insumoId: 'ins_1',
  codigo: 'FIL-001',
  nombre: 'Filtro de aceite motor',
  stockSucursal: 10,
  stockTotal: 30,
  stockMinimo: 4,
  bajoMinimo: false,
};

/** Lo tengo acá pero quedan pocos: sirve hoy, hay que reponer. */
const POCO = {
  ...BASE,
  compatibilidadId: 'comp_2',
  insumoId: 'ins_2',
  codigo: 'COR-001',
  nombre: 'Correa de alternador',
  nota: 'Requiere adaptador',
  stockSucursal: 2,
  stockTotal: 2,
  stockMinimo: 5,
  bajoMinimo: true,
};

/** No lo tengo acá pero la empresa sí: se pide traslado, no compra. */
const EN_OTRA = {
  ...BASE,
  compatibilidadId: 'comp_3',
  insumoId: 'ins_3',
  codigo: 'NEU-001',
  nombre: 'Neumático 29.5R25',
  stockSucursal: 0,
  stockTotal: 2,
  stockMinimo: 4,
  bajoMinimo: true,
};

function renderView(
  repuestos: unknown[],
  replicables: unknown[] = [],
): ReturnType<typeof render> {
  const qc = new QueryClient();
  qc.setQueryData(['sucursales', { activa: true }], SUCURSALES);
  qc.setQueryData(
    ['compatibilidad', 'equipo', 'eq_1', { sucursalId: 'suc_1' }],
    { equipo: EQUIPO, sucursalId: 'suc_1', repuestos },
  );
  qc.setQueryData(['compatibilidad', 'replicables', 'eq_1'], replicables);
  qc.setQueryData(['inventario', 'insumos', {}], []);

  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={['/equipos/eq_1/repuestos']}>
        <Routes>
          <Route
            element={<RepuestosEquipoView />}
            path="/equipos/:id/repuestos"
          />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('RepuestosEquipoView', () => {
  it('distingue lo que tengo acá de lo que está en otra sucursal', () => {
    renderView([EN_BODEGA, EN_OTRA]);

    // Es el cruce que da valor a la funcionalidad: "sirve" sin "lo tengo" no
    // cambia ninguna decisión del mantenedor.
    expect(screen.getAllByText('En esta bodega')).toHaveLength(1);
    expect(screen.getAllByText('En otra sucursal')).toHaveLength(1);
  });

  it('no confunde "quedan pocos" con "no hay"', () => {
    renderView([POCO]);

    // Tener 2 no es no tener: se puede montar hoy. La reposición es otra
    // alerta y se muestra aparte.
    expect(screen.getAllByText('En esta bodega')).toHaveLength(1);
    expect(screen.getAllByText('Bajo mínimo')).toHaveLength(1);
  });

  it('muestra la salvedad declarada junto al repuesto', () => {
    renderView([POCO]);

    // La nota es el conocimiento que hoy vive en la cabeza del mecánico;
    // esconderla detrás de un clic sería perder la mitad del valor.
    expect(screen.getByText('Requiere adaptador')).toBeTruthy();
  });

  it('ofrece copiar de un equipo del mismo modelo cuando no hay ninguna declarada', () => {
    renderView([], [{ equipoId: 'eq_7', codigo: 'EX-007', cantidad: 5 }]);

    // Cierra el punto débil del modelo N:M (RFC-12 §4) en el momento exacto en
    // que se nota: al abrir la pantalla y verla vacía.
    expect(screen.getByText(/EX-007 es del mismo modelo/)).toBeTruthy();
    expect(screen.getByText('Copiar de EX-007')).toBeTruthy();
  });

  it('no ofrece copiar cuando el equipo ya tiene repuestos declarados', () => {
    renderView([EN_BODEGA], [{ equipoId: 'eq_7', codigo: 'EX-007', cantidad: 5 }]);

    expect(screen.queryByText('Copiar de EX-007')).toBeNull();
  });
});
