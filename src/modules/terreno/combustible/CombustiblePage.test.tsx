import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { CombustiblePage } from './CombustiblePage';

afterEach(cleanup);

// Render de CLIENTE con datos precargados: así se renderizan los ítems de
// colección de React-Aria (opciones del Select y filas de la Table), que es
// donde se dispara "cannot be rendered outside a collection".
describe('CombustiblePage', () => {
  it('renderiza con datos sin lanzar', () => {
    const qc = new QueryClient();
    qc.setQueryData(
      ['equipos'],
      [{ id: 'e1', codigo: 'EX-001', tipo: 'Excavadora', marca: 'Cat', modelo: '336', estado: 'OPERATIVO', horometroActual: 100, kilometrajeActual: 0 }],
    );
    qc.setQueryData(
      ['combustible'],
      [{ id: 'r1', equipoId: 'e1', litros: 20, fotoUrl: null, rendimiento: 5, fecha: '2026-08-01T00:00:00.000Z', equipo: { codigo: 'EX-001' } }],
    );

    render(
      <QueryClientProvider client={qc}>
        <CombustiblePage />
      </QueryClientProvider>,
    );

    expect(screen.getByText('Cargas de combustible')).toBeTruthy();
    // La fila con el equipo debe estar presente (tabla renderizada de verdad).
    expect(screen.getAllByText('EX-001').length).toBeGreaterThan(0);
  });
});
