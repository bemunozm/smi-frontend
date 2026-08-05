import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

import { FichaEquipoView } from './FichaEquipoView';
import type { FichaEquipo } from '../types/ficha';

vi.mock('../hooks/useCurrentUser', () => ({
  useCurrentUser: () => ({
    user: { id: 'u1', name: 'Admin SMI', email: 'admin@smi.local', role: 'ADMIN' },
    role: 'ADMIN',
    isPending: false,
    isAuthenticated: true,
  }),
}));

afterEach(cleanup);

const FICHA: FichaEquipo = {
  equipo: {
    id: 'eq_1',
    codigo: 'EX-001',
    tipo: 'Excavadora',
    marca: 'Caterpillar',
    modelo: '336',
    anio: 2019,
    estado: 'DISPONIBLE',
    horometroActual: 1200,
    kilometrajeActual: 0,
  },
  resumen: {
    combustibles: 2,
    horometros: 3,
    trabajosExtra: 5,
    hallazgos: 1,
    hallazgosAbiertos: 1,
    ordenes: 4,
    ordenesAbiertas: 2,
    actividades: 6,
  },
  timeline: [
    {
      id: 'ev_combustible',
      tipo: 'COMBUSTIBLE',
      fecha: '2026-08-01T10:00:00.000Z',
      titulo: 'Carga de combustible 50 L',
      detalle: 'Tipo: DIESEL',
      meta: { litros: 50, tipo: 'DIESEL', fotoUrl: null },
    },
    {
      id: 'ev_hallazgo',
      tipo: 'HALLAZGO',
      fecha: '2026-07-30T09:00:00.000Z',
      titulo: 'Hallazgo ALTA — abierto',
      detalle: 'Fuga de aceite en el motor',
      meta: { prioridad: 'ALTA', estado: 'ABIERTO', fotoUrl: null },
    },
    {
      id: 'ev_orden',
      tipo: 'ORDEN_TRABAJO',
      fecha: '2026-07-29T08:00:00.000Z',
      titulo: 'Orden de trabajo — Cambio de aceite',
      detalle: 'CORRECTIVA · origen: HALLAZGO',
      meta: { estado: 'PENDIENTE', prioridad: 'ALTA', tipo: 'CORRECTIVA', origen: 'HALLAZGO', asignadoAId: null },
    },
    {
      id: 'ev_horometro',
      tipo: 'HOROMETRO',
      fecha: '2026-07-28T07:00:00.000Z',
      titulo: 'Registro de horómetro — turno DIA',
      detalle: 'Operador: Juan. Inicial: 1180, final: 1188',
      meta: { operador: 'Juan', turno: 'DIA', valorInicial: 1180, valorFinal: 1188, nivelCombustible: 80 },
    },
  ],
};

function renderConFicha(ficha: FichaEquipo | null) {
  const qc = new QueryClient();
  qc.setQueryData(['ficha', 'eq_1'], ficha);

  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={['/equipos/eq_1/ficha']}>
        <Routes>
          <Route element={<FichaEquipoView />} path="/equipos/:id/ficha" />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('FichaEquipoView', () => {
  it('muestra la cabecera del equipo y los contadores del resumen', () => {
    renderConFicha(FICHA);

    // Cabecera: código en el título + estado en el chip.
    expect(screen.getByText('EX-001')).toBeTruthy();
    expect(screen.getByText('Disponible')).toBeTruthy();

    // Contadores del resumen (valores elegidos distintos entre sí a propósito).
    expect(screen.getByText('2')).toBeTruthy(); // combustibles
    expect(screen.getByText('3')).toBeTruthy(); // horometros
    expect(screen.getByText('5')).toBeTruthy(); // trabajosExtra
    expect(screen.getByText('4')).toBeTruthy(); // ordenes
    expect(screen.getByText('6')).toBeTruthy(); // actividades
    expect(screen.getByText('1 abierto')).toBeTruthy(); // hallazgosAbiertos
    expect(screen.getByText('2 abiertas')).toBeTruthy(); // ordenesAbiertas
  });

  it('lista los eventos de la timeline con sus dominios', () => {
    renderConFicha(FICHA);

    expect(screen.getByText('Carga de combustible 50 L')).toBeTruthy();
    expect(screen.getByText('Hallazgo ALTA — abierto')).toBeTruthy();
    expect(screen.getByText('Orden de trabajo — Cambio de aceite')).toBeTruthy();
    expect(screen.getByText('Registro de horómetro — turno DIA')).toBeTruthy();
  });

  it('el filtro por tipo oculta los eventos de los tipos deseleccionados', () => {
    renderConFicha(FICHA);

    expect(screen.getByText('Orden de trabajo — Cambio de aceite')).toBeTruthy();

    // Desactiva el chip "Orden de trabajo" — el filtro es multi-select, el
    // resto de tipos sigue seleccionado.
    fireEvent.click(screen.getByRole('button', { name: 'Orden de trabajo (1)' }));

    expect(screen.queryByText('Orden de trabajo — Cambio de aceite')).toBeNull();
    // Los demás tipos siguen visibles.
    expect(screen.getByText('Carga de combustible 50 L')).toBeTruthy();
    expect(screen.getByText('Hallazgo ALTA — abierto')).toBeTruthy();
  });

  it('muestra el estado vacío cuando la ficha no tiene eventos', () => {
    renderConFicha({ ...FICHA, timeline: [] });

    expect(screen.getByText('Sin eventos registrados')).toBeTruthy();
  });

  it('renderiza la cabecera cuando el equipo no tiene año registrado (anio: null)', () => {
    // Regresión del bug bloqueante: el backend modela `Equipo.anio` como
    // `Int?` — un equipo sin año no debe romper el parseo de la respuesta
    // (`FichaResponseSchema.parse`) ni la vista.
    renderConFicha({ ...FICHA, equipo: { ...FICHA.equipo, anio: null } });

    expect(screen.getByText('EX-001')).toBeTruthy();
    expect(screen.queryByText('Respuesta inválida')).toBeNull();
  });

  it('el filtro sin ningún tipo seleccionado muestra el empty state y permite restaurar', () => {
    renderConFicha(FICHA);

    // Deselecciona los 4 tipos presentes en la fixture uno por uno.
    fireEvent.click(screen.getByRole('button', { name: 'Combustible (1)' }));
    fireEvent.click(screen.getByRole('button', { name: 'Hallazgo (1)' }));
    fireEvent.click(screen.getByRole('button', { name: 'Orden de trabajo (1)' }));
    fireEvent.click(screen.getByRole('button', { name: 'Horómetro (1)' }));

    expect(screen.getByText('Ningún evento coincide con el filtro')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Mostrar todos los tipos' }));

    expect(screen.queryByText('Ningún evento coincide con el filtro')).toBeNull();
    expect(screen.getByText('Carga de combustible 50 L')).toBeTruthy();
  });
});
