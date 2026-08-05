import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { CombustiblePage } from './CombustiblePage';

afterEach(cleanup);

describe('CombustiblePage', () => {
  it('renderiza con datos sin lanzar', () => {
    const qc = new QueryClient();
    qc.setQueryData(
      ['equipos'],
      [{ id: 'e1', codigo: 'EX-001', tipo: 'Excavadora', marca: 'Cat', modelo: '336', estado: 'OPERATIVO', horometroActual: 1180, kilometrajeActual: 0 }],
    );
    qc.setQueryData(
      ['combustible'],
      [{ id: 'r1', equipoId: 'e1', litros: 120, tipo: 'PETROLEO', fotoUrl: null, fecha: '2026-08-01T09:20:00.000Z', equipo: { codigo: 'EX-001' } }],
    );

    render(
      <QueryClientProvider client={qc}>
        <CombustiblePage />
      </QueryClientProvider>,
    );

    expect(screen.getByText('Registrar carga')).toBeTruthy();
    expect(screen.getByText('Tipo de combustible')).toBeTruthy();
    expect(screen.getAllByText('EX-001').length).toBeGreaterThan(0);
  });
});
