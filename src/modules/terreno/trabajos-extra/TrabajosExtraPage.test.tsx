import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TrabajosExtraPage } from './TrabajosExtraPage';

afterEach(cleanup);

describe('TrabajosExtraPage', () => {
  it('renderiza con datos sin lanzar', () => {
    const qc = new QueryClient();
    qc.setQueryData(
      ['equipos'],
      [{ id: 'e1', codigo: 'EX-001', tipo: 'Excavadora', marca: 'Cat', modelo: '336', estado: 'OPERATIVO', horometroActual: 100, kilometrajeActual: 0 }],
    );
    qc.setQueryData(
      ['trabajos-extra'],
      [{ id: 'r1', equipoId: 'e1', cliente: 'Minera Norte', horasMaquina: 12, tonelaje: null, tarifa: 85000, monto: 1020000, fotoUrl: null, fecha: '2026-08-01T00:00:00.000Z', equipo: { codigo: 'EX-001' } }],
    );

    render(
      <QueryClientProvider client={qc}>
        <TrabajosExtraPage />
      </QueryClientProvider>,
    );

    expect(screen.getByText('Trabajos extraordinarios')).toBeTruthy();
    expect(screen.getByText('Minera Norte')).toBeTruthy();
  });
});
