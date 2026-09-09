import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TrabajosExtraView } from './TrabajosExtraView';

afterEach(cleanup);

describe('TrabajosExtraView', () => {
  it('renderiza con datos sin lanzar', () => {
    const qc = new QueryClient();
    qc.setQueryData(
      ['equipment'],
      [{ id: 'e1', internalCode: 'CM-003', type: 'Camión' }],
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
          equipo: { internalCode: 'CM-003' },
        },
      ],
    );

    render(
      <QueryClientProvider client={qc}>
        <TrabajosExtraView />
      </QueryClientProvider>,
    );

    expect(screen.getByText('Trabajo extraordinario')).toBeTruthy();
    expect(screen.getByText('Registrar trabajo')).toBeTruthy();
    expect(screen.getByText(/Rajo Norte/)).toBeTruthy();
    // 'Regulación y carga' aparece en el select y en la tarjeta de la lista
    expect(screen.getAllByText('Regulación y carga').length).toBeGreaterThan(0);
  });
});
