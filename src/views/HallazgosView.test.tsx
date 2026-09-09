import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { HallazgosView } from './HallazgosView';

afterEach(cleanup);

describe('HallazgosView', () => {
  it('renderiza con datos sin lanzar', () => {
    const qc = new QueryClient();
    qc.setQueryData(
      ['equipment'],
      [{ id: 'e1', internalCode: 'PE-004', type: 'Perforadora' }],
    );
    qc.setQueryData(
      ['hallazgos'],
      [{ id: 'h1', equipoId: 'e1', descripcion: 'Fuga de aceite hidráulico', prioridad: 'ALTA', estado: 'ABIERTO', fotoUrl: null, fecha: '2026-08-01T08:12:00.000Z', equipo: { internalCode: 'PE-004' } }],
    );

    render(
      <QueryClientProvider client={qc}>
        <HallazgosView />
      </QueryClientProvider>,
    );

    expect(screen.getByText('Nivel de prioridad')).toBeTruthy();
    expect(screen.getByText('Registrar hallazgo')).toBeTruthy();
    expect(screen.getByText('Fuga de aceite hidráulico')).toBeTruthy();
  });
});
