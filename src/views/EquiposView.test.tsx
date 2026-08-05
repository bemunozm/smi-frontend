import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

import { EquipoDetalleView } from './EquipoDetalleView';
import { EquiposView } from './EquiposView';

// La sesión real la resuelve Better Auth contra el backend; acá solo importa
// qué rol ve la pantalla, que es lo que decide las acciones visibles.
vi.mock('../hooks/useCurrentUser', () => ({
  useCurrentUser: () => ({
    user: { id: 'u1', name: 'Admin SMI', email: 'admin@smi.local', role: 'ADMIN' },
    role: 'ADMIN',
    isPending: false,
    isAuthenticated: true,
  }),
}));

afterEach(cleanup);

const EQUIPO = {
  id: 'eq_1',
  codigo: 'EX-001',
  tipo: 'Excavadora',
  marca: 'Caterpillar',
  modelo: '336',
  anio: 2019,
  estado: 'DISPONIBLE' as const,
  horometroActual: 1200,
  kilometrajeActual: 0,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

function renderConDatos(ui: React.ReactElement, seed: (qc: QueryClient) => void, ruta = '/') {
  const qc = new QueryClient();
  seed(qc);
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[ruta]}>{ui}</MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('EquiposView', () => {
  it('lista los equipos con su estado y uso', () => {
    renderConDatos(<EquiposView />, (qc) => {
      qc.setQueryData(['equipos'], [EQUIPO]);
      qc.setQueryData(['equipos', 'resumen'], {
        total: 1,
        disponibles: 1,
        porEstado: { DISPONIBLE: 1, EN_RUTA: 0, EN_MANTENCION: 0, DE_BAJA: 0 },
      });
    });

    expect(screen.getByText('EX-001')).toBeTruthy();
    expect(screen.getByText('Excavadora')).toBeTruthy();
    // El estado se muestra con la etiqueta en español, no con el valor del enum.
    expect(screen.getAllByText('Disponible').length).toBeGreaterThan(0);
    expect(screen.getByText('1.200 h')).toBeTruthy();
  });

  it('muestra el estado vacío cuando ningún equipo coincide', () => {
    renderConDatos(<EquiposView />, (qc) => {
      qc.setQueryData(['equipos'], []);
      qc.setQueryData(['equipos', 'resumen'], {
        total: 0,
        disponibles: 0,
        porEstado: { DISPONIBLE: 0, EN_RUTA: 0, EN_MANTENCION: 0, DE_BAJA: 0 },
      });
    });

    expect(screen.getByText('No hay equipos que coincidan')).toBeTruthy();
  });

});

describe('EquipoDetalleView', () => {
  it('muestra la ficha técnica y los contadores por dominio', () => {
    const qc = new QueryClient();
    qc.setQueryData(['equipos', 'eq_1'], {
      ...EQUIPO,
      _count: { combustibles: 2, horometros: 3, trabajosExtra: 1, hallazgos: 4, movimientos: 5 },
      movimientos: [
        {
          id: 'mov_1',
          tipo: 'SALIDA',
          origen: 'INTERVENCION',
          cantidad: 60,
          saldoResultante: 140,
          observacion: 'Cambio de aceite',
          fecha: '2026-08-01T12:00:00.000Z',
          insumo: { codigo: 'ACE-001', nombre: 'Aceite motor 15W-40', unidad: 'LITRO' },
        },
      ],
    });

    render(
      <QueryClientProvider client={qc}>
        <MemoryRouter initialEntries={['/equipos/eq_1']}>
          <Routes>
            <Route element={<EquipoDetalleView />} path="/equipos/:id" />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );

    // El código aparece dos veces: en el título y en la fila "Código / patente".
    expect(screen.getAllByText('EX-001').length).toBe(2);
    expect(screen.getByText('Aceite motor 15W-40')).toBeTruthy();
    expect(screen.getByText('1.200 h')).toBeTruthy();
    // El consumo se muestra con signo según el tipo de movimiento.
    expect(screen.getByText('−60')).toBeTruthy();
    // Los contadores por dominio vienen del `_count` que arma el backend.
    expect(screen.getByText('Hallazgos')).toBeTruthy();
    expect(screen.getByText('Lecturas horómetro')).toBeTruthy();
  });
});
