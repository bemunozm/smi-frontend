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
      [{ id: 'e1', codigo: 'CM-003', tipo: 'Camión', marca: 'Volvo', modelo: 'FMX', estado: 'OPERATIVO', horometroActual: 100, kilometrajeActual: 0 }],
    );
    qc.setQueryData(
      ['trabajos-extra'],
      [
        {
          id: 'r1',
          equipoId: 'e1',
          operador: 'Juan Rojas',
          faena: 'Rajo Norte',
          turno: 'DIURNO',
          horometroInicial: 5388,
          horometroFinal: 5400,
          totalHoras: 12,
          actividad: 'REGULACION_CARGA',
          descripcion: 'Carga de material',
          observaciones: null,
          fecha: '2026-08-01T09:00:00.000Z',
          equipo: { codigo: 'CM-003' },
        },
      ],
    );

    render(
      <QueryClientProvider client={qc}>
        <TrabajosExtraPage />
      </QueryClientProvider>,
    );

    expect(screen.getByText('Trabajo extraordinario')).toBeTruthy();
    expect(screen.getByText('Registrar trabajo')).toBeTruthy();
    expect(screen.getByText(/Rajo Norte/)).toBeTruthy();
    // 'Regulación y carga' aparece en el select y en la tarjeta de la lista
    expect(screen.getAllByText('Regulación y carga').length).toBeGreaterThan(0);
  });
});
