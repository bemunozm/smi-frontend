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

// Los formularios (create/edit) consultan sucursales para el selector
// `homeBranch` — mockeada sin datos porque estos tests no abren esos modales.
vi.mock('../hooks/useBranches', () => ({
  useBranches: () => ({ data: [] }),
}));

afterEach(cleanup);

const EQUIPO = {
  id: 'eq_1',
  internalCode: 'EX-001',
  licensePlate: null,
  equipmentClass: 'HEAVY' as const,
  type: 'Excavadora',
  brand: 'Caterpillar',
  model: '336',
  year: 2019,
  controlUnit: 'HOURS' as const,
  currentHourmeter: 1200,
  currentMileage: null,
  status: 'OPERATIONAL' as const,
  homeBranchId: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

// Sin esto, el `QueryClient` por defecto (`staleTime: 0`) trata los datos
// sembrados con `setQueryData` como stale de entrada: al montar, cada
// `useQuery` dispara un refetch en segundo plano contra la API real (axios),
// aunque la key ya esté seedeada — acá eso incluye `HorometroAPI`/
// `CombustibleAPI`, que no están mockeadas en este archivo. `retry: false`
// evita además que un fallo de red quede reintentando en segundo plano.
function crearQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: { queries: { staleTime: Infinity, retry: false } },
  });
}

function renderConDatos(ui: React.ReactElement, seed: (qc: QueryClient) => void, ruta = '/') {
  const qc = crearQueryClient();
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
      qc.setQueryData(['equipment'], [EQUIPO]);
      qc.setQueryData(['equipment', 'resumen'], {
        total: 1,
        disponibles: 1,
        porEstado: { OPERATIONAL: 1, IN_WORKSHOP: 0, OUT_OF_SERVICE: 0 },
      });
    });

    // El código y el uso aparecen dos veces: en la tabla (PC) y en la
    // tarjeta equivalente (tablet/celular) — ambas vistas conviven en el DOM,
    // la que se ve depende del breakpoint (CSS, no de jsdom).
    expect(screen.getAllByText('EX-001').length).toBeGreaterThan(0);
    expect(screen.getByText('Excavadora')).toBeTruthy();
    // El estado se muestra con la etiqueta en español, no con el valor del enum.
    expect(screen.getAllByText('Operativo').length).toBeGreaterThan(0);
    expect(screen.getAllByText('1.200 h').length).toBeGreaterThan(0);
  });

  it('muestra el estado vacío cuando ningún equipo coincide', () => {
    renderConDatos(<EquiposView />, (qc) => {
      qc.setQueryData(['equipment'], []);
      qc.setQueryData(['equipment', 'resumen'], {
        total: 0,
        disponibles: 0,
        porEstado: { OPERATIONAL: 0, IN_WORKSHOP: 0, OUT_OF_SERVICE: 0 },
      });
    });

    expect(screen.getByText('No hay equipos que coincidan')).toBeTruthy();
  });

});

describe('EquipoDetalleView', () => {
  it('muestra la ficha técnica y los contadores por dominio', () => {
    const qc = crearQueryClient();
    qc.setQueryData(['equipment', 'eq_1'], {
      ...EQUIPO,
      homeBranch: null,
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
    // `EquipoDetalleView` también consulta el historial de horómetro/combustible
    // (sección "Combustible") — mismas queries globales que usa Terreno, sin
    // filtro por equipo. Sin seedearlas acá, el `useQuery` real dispararía una
    // request de axios de verdad contra un backend inexistente.
    qc.setQueryData(
      ['horometro'],
      [
        // Equipo distinto y más reciente: debe quedar afuera del "último nivel".
        {
          id: 'h_otro',
          equipoId: 'eq_9',
          operador: 'Pedro',
          turno: 'NOCTURNO',
          valorInicial: 10,
          valorFinal: 20,
          nivelCombustible: 10,
          fecha: '2026-08-10T08:00:00.000Z',
        },
        {
          id: 'h_viejo',
          equipoId: 'eq_1',
          operador: 'Juan',
          turno: 'DIURNO',
          valorInicial: 1150,
          valorFinal: 1160,
          nivelCombustible: 50,
          fecha: '2026-08-01T08:00:00.000Z',
        },
        {
          id: 'h_nuevo',
          equipoId: 'eq_1',
          operador: 'Ana',
          turno: 'DIURNO',
          valorInicial: 1180,
          valorFinal: 1195,
          nivelCombustible: 72,
          fecha: '2026-08-05T08:00:00.000Z',
        },
      ],
    );
    qc.setQueryData(
      ['combustible'],
      [
        {
          id: 'c_1',
          equipoId: 'eq_1',
          litros: 80,
          tipo: 'PETROLEO',
          fotoUrl: null,
          fecha: '2026-08-04T09:00:00.000Z',
        },
      ],
    );

    render(
      <QueryClientProvider client={qc}>
        <MemoryRouter initialEntries={['/equipos/eq_1']}>
          <Routes>
            <Route element={<EquipoDetalleView />} path="/equipos/:id" />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );

    // El código aparece dos veces: en el título y en la fila "Código interno".
    expect(screen.getAllByText('EX-001').length).toBe(2);
    expect(screen.getByText('Aceite motor 15W-40')).toBeTruthy();
    // KPI hero: uso acumulado, ahora único (ya no se repite en la ficha técnica).
    expect(screen.getByText('1.200 h')).toBeTruthy();
    // El consumo se muestra con signo según el tipo de movimiento.
    expect(screen.getByText('−60')).toBeTruthy();
    // Los contadores por dominio vienen del `_count` que arma el backend.
    expect(screen.getByText('Hallazgos')).toBeTruthy();
    expect(screen.getByText('Lecturas horómetro')).toBeTruthy();

    // Sección Combustible: último nivel = la lectura MÁS RECIENTE de ESTE
    // equipo que trae `nivelCombustible` (72%, no 50% ni el 10% de "eq_9").
    expect(screen.getByText('72%')).toBeTruthy();
    expect(screen.getByText('Petróleo')).toBeTruthy();
    expect(screen.getByText('80 L')).toBeTruthy();

    // Los botones de registro abren el flujo foto→OCR→EXIF (Fase B) — ya no
    // están deshabilitados. La interacción completa (capturar foto, ver el
    // autorrelleno OCR/EXIF, guardar) se prueba en los tests dedicados de
    // `RegistrarLecturaModal`/`RegistrarCargaCombustibleModal`.
    const botonLectura = screen.getByRole('button', { name: 'Registrar lectura' });
    const botonCarga = screen.getByRole('button', { name: 'Registrar carga' });
    expect(botonLectura.hasAttribute('disabled')).toBe(false);
    expect(botonCarga.hasAttribute('disabled')).toBe(false);
  });
});
