import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { HallazgosPage } from './HallazgosPage';

afterEach(cleanup);

describe('HallazgosPage', () => {
  it('renderiza con datos sin lanzar', () => {
    const qc = new QueryClient();
    qc.setQueryData(
      ['equipos'],
      [{ id: 'e1', codigo: 'EX-001', tipo: 'Excavadora', marca: 'Cat', modelo: '336', estado: 'OPERATIVO', horometroActual: 100, kilometrajeActual: 0 }],
    );
    qc.setQueryData(
      ['hallazgos'],
      [{ id: 'h1', equipoId: 'e1', descripcion: 'Fuga de aceite', criticidad: 'ALTA', estado: 'ABIERTO', fotoUrl: null, fecha: '2026-08-01T00:00:00.000Z', equipo: { codigo: 'EX-001' } }],
    );

    render(
      <QueryClientProvider client={qc}>
        <HallazgosPage />
      </QueryClientProvider>,
    );

    expect(screen.getByText('Fuga de aceite')).toBeTruthy();
    expect(screen.getByText('ALTA')).toBeTruthy();
  });
});
