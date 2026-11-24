import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';

import { EquiposView } from './EquiposView';

vi.mock('../hooks/useCurrentUser', () => ({
  useCurrentUser: () => ({
    user: { id: 'u1', name: 'Admin SMI', email: 'admin@smi.local', role: 'ADMIN' },
    role: 'ADMIN',
    isPending: false,
    isAuthenticated: true,
  }),
}));
vi.mock('../hooks/useBranches', () => ({ useBranches: () => ({ data: [] }) }));

afterEach(cleanup);

const BASE = {
  licensePlate: null,
  year: 2020,
  photoUrl: null,
  homeBranchId: null,
  operator: null,
  supervisor: null,
  inUse: false,
  openShift: null,
  documentsAlert: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

// El servidor las entrega por código; acá van en otro orden para ver el del cliente.
const EQUIPOS = [
  {
    ...BASE,
    id: 'a',
    internalCode: 'CAM-010',
    licensePlate: 'ZZ1111',
    equipmentClass: 'LIGHT' as const,
    type: 'Camioneta',
    brand: 'Toyota',
    model: 'Hilux',
    controlUnit: 'KM' as const,
    currentHourmeter: null,
    currentMileage: 52000,
    status: 'IN_WORKSHOP' as const,
    currentFuelLevel: null,
  },
  {
    ...BASE,
    id: 'b',
    internalCode: 'EX-002',
    equipmentClass: 'HEAVY' as const,
    type: 'Excavadora',
    brand: 'Caterpillar',
    model: '336',
    controlUnit: 'HOURS' as const,
    currentHourmeter: 900,
    currentMileage: null,
    status: 'OPERATIONAL' as const,
    currentFuelLevel: 40,
    operator: { id: 'op2', name: 'Zoe Paz' },
    inUse: true,
  },
  {
    ...BASE,
    id: 'c',
    internalCode: 'EX-001',
    equipmentClass: 'HEAVY' as const,
    type: 'Excavadora',
    brand: 'Caterpillar',
    model: '320',
    controlUnit: 'HOURS' as const,
    currentHourmeter: 1200,
    currentMileage: null,
    status: 'OUT_OF_SERVICE' as const,
    currentFuelLevel: 80,
    operator: { id: 'op1', name: 'Abel Soto' },
    inUse: true,
  },
];

function renderVista() {
  const qc = new QueryClient({ defaultOptions: { queries: { staleTime: Infinity, retry: false } } });
  qc.setQueryData(['equipment'], EQUIPOS);
  qc.setQueryData(['equipment', 'resumen'], {
    total: 3,
    disponibles: 1,
    porEstado: { OPERATIONAL: 1, IN_WORKSHOP: 1, OUT_OF_SERVICE: 1 },
  });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <EquiposView />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

/** Códigos de las filas de la tabla, en el orden en que están. */
const codigos = () =>
  screen
    .getAllByRole('row')
    .slice(1)
    .map((fila) => /(CAM|EX)-\d{3}/.exec(fila.textContent ?? '')?.[0]);

const titulo = (nombre: RegExp) => screen.getByRole('columnheader', { name: nombre });

describe('EquiposView — orden', () => {
  it('por defecto respeta el orden del servidor y la bajada lo dice', () => {
    renderVista();
    expect(codigos()).toEqual(['CAM-010', 'EX-002', 'EX-001']);
    expect(screen.getByTestId('orden-equipos').textContent).toMatch(/Ordenado por código/);
    expect(screen.getByTestId('orden-equipos').textContent).toMatch(/Toca el título/);
  });

  it('tocar «Equipo» ordena por código y volver a tocarlo invierte', () => {
    renderVista();
    fireEvent.click(titulo(/^Equipo/));
    expect(codigos()).toEqual(['CAM-010', 'EX-001', 'EX-002']);
    fireEvent.click(titulo(/^Equipo/));
    expect(codigos()).toEqual(['EX-002', 'EX-001', 'CAM-010']);
    expect(screen.getByTestId('orden-equipos').textContent).toMatch(/Ordenado por código, de la Z a la A/);
  });

  it('el estado ordena por su orden lógico (operativo, en taller, fuera de servicio)', () => {
    renderVista();
    fireEvent.click(titulo(/Estado/));
    expect(codigos()).toEqual(['EX-002', 'CAM-010', 'EX-001']);
    fireEvent.click(titulo(/Estado/));
    expect(codigos()).toEqual(['EX-001', 'CAM-010', 'EX-002']);
  });

  it('horómetro / km ordena como número, no como texto', () => {
    renderVista();
    fireEvent.click(titulo(/Horómetro/));
    expect(codigos()).toEqual(['EX-002', 'EX-001', 'CAM-010']);
  });

  it('combustible y «En uso por» dejan los vacíos al final, también al invertir', () => {
    renderVista();
    fireEvent.click(titulo(/Combustible/));
    expect(codigos()).toEqual(['EX-002', 'EX-001', 'CAM-010']);
    fireEvent.click(titulo(/Combustible/));
    expect(codigos()).toEqual(['EX-001', 'EX-002', 'CAM-010']);
    fireEvent.click(titulo(/En uso por/));
    expect(codigos()).toEqual(['EX-001', 'EX-002', 'CAM-010']);
    fireEvent.click(titulo(/En uso por/));
    expect(codigos()).toEqual(['EX-002', 'EX-001', 'CAM-010']);
  });

  it('el selector «Ordenar por» (celular) comparte el estado: patente y clase', () => {
    renderVista();
    fireEvent.change(screen.getByTestId('orden-columna'), { target: { value: 'patente' } });
    // Solo la camioneta tiene patente: va primero; los sin patente, por código.
    expect(codigos()).toEqual(['CAM-010', 'EX-001', 'EX-002']);
    fireEvent.change(screen.getByTestId('orden-columna'), { target: { value: 'clase' } });
    // Pesados antes que livianos.
    expect(codigos()).toEqual(['EX-001', 'EX-002', 'CAM-010']);
    fireEvent.click(screen.getByTestId('orden-direccion'));
    expect(codigos()[0]).toBe('CAM-010');
  });
});
