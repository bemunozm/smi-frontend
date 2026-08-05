import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { HorometroPage } from './HorometroPage';

afterEach(cleanup);

describe('HorometroPage', () => {
  it('renderiza con datos sin lanzar', () => {
    const qc = new QueryClient();
    qc.setQueryData(
      ['equipos'],
      [{ id: 'e1', codigo: 'EX-001', tipo: 'Excavadora', marca: 'Cat', modelo: '336', estado: 'OPERATIVO', horometroActual: 100, kilometrajeActual: 0 }],
    );
    qc.setQueryData(
      ['horometro'],
      [{ id: 'r1', equipoId: 'e1', operadorId: 'op1', turno: 'MANANA', valorInicial: 100, valorFinal: 130, fecha: '2026-08-01T00:00:00.000Z', equipo: { codigo: 'EX-001' } }],
    );

    render(
      <QueryClientProvider client={qc}>
        <HorometroPage />
      </QueryClientProvider>,
    );

    expect(screen.getByText('Registro de horómetro por turno')).toBeTruthy();
    expect(screen.getAllByText('EX-001').length).toBeGreaterThan(0);
  });
});
