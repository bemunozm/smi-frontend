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
      [{ id: 'e1', codigo: 'PE-004', tipo: 'Perforadora', marca: 'Sandvik', modelo: 'DP1500', estado: 'DETENIDO', horometroActual: 300, kilometrajeActual: 0 }],
    );
    qc.setQueryData(
      ['hallazgos'],
      [{ id: 'h1', equipoId: 'e1', descripcion: 'Fuga de aceite hidráulico', criticidad: 'ALTA', estado: 'ABIERTO', fotoUrl: null, fecha: '2026-08-01T08:12:00.000Z', equipo: { codigo: 'PE-004' } }],
    );

    render(
      <QueryClientProvider client={qc}>
        <HallazgosPage />
      </QueryClientProvider>,
    );

    expect(screen.getByText('Hallazgos del turno')).toBeTruthy();
    expect(screen.getByText('Registrar hallazgo')).toBeTruthy();
    expect(screen.getByText('Fuga de aceite hidráulico')).toBeTruthy();
  });
});
