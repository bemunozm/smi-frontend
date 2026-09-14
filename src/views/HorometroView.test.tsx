import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { HorometroView } from './HorometroView';

afterEach(cleanup);

describe('HorometroView', () => {
  it('renderiza con datos sin lanzar', () => {
    const qc = new QueryClient();
    qc.setQueryData(
      ['equipment'],
      [{ id: 'e1', internalCode: 'EX-001', type: 'Excavadora' }],
    );
    qc.setQueryData(
      ['horometro'],
      [{ id: 'r1', equipoId: 'e1', operador: 'Juan Rojas', turno: 'DIURNO', valorInicial: 1180, valorFinal: 1200, nivelCombustible: 75, fecha: '2026-08-01T09:00:00.000Z', equipo: { internalCode: 'EX-001' } }],
    );

    render(
      <QueryClientProvider client={qc}>
        <HorometroView />
      </QueryClientProvider>,
    );

    expect(screen.getByText('Lectura de turno')).toBeTruthy();
    expect(screen.getByText('Registrar lectura')).toBeTruthy();
    expect(screen.getByText('Juan Rojas')).toBeTruthy();
  });
});
