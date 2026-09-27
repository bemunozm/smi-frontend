import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup, screen, within } from '@testing-library/react';
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

    expect(screen.getByRole('heading', { name: 'Trabajos extraordinarios' })).toBeTruthy();
    expect(screen.getByText('Registrar trabajo')).toBeTruthy();
    // La faena del registro histórico se muestra tal como quedó guardada,
    // aunque el formulario ya solo ofrezca Patillo y Kainita.
    expect(screen.getByText(/Rajo Norte/)).toBeTruthy();
    // 'Regulación y carga' aparece en el select y en la tarjeta de la lista
    expect(screen.getAllByText('Regulación y carga').length).toBeGreaterThan(0);
  });

  /**
   * Un equipo con turno en curso está ocupado: sus horas todavía no están
   * cerradas, así que las del trabajo extraordinario podrían terminar
   * contadas dos veces. El servidor lo rechaza; la vista además no lo ofrece,
   * para no mostrar una opción que va a fallar.
   */
  it('no ofrece equipos con un turno en curso', () => {
    const qc = new QueryClient();
    qc.setQueryData(
      ['equipment'],
      [
        { id: 'e1', internalCode: 'CM-003', type: 'Camión' },
        { id: 'e2', internalCode: 'CA-011', type: 'Cargador' },
      ],
    );
    qc.setQueryData(['trabajos-extra'], []);
    // CA-011 abrió turno y todavía no lo cerró: `valorFinal` en null.
    qc.setQueryData(
      ['horometro'],
      [
        { id: 'h1', equipoId: 'e2', valorInicial: 100, valorFinal: null },
        { id: 'h2', equipoId: 'e1', valorInicial: 50, valorFinal: 62 },
      ],
    );

    render(
      <QueryClientProvider client={qc}>
        <TrabajosExtraView />
      </QueryClientProvider>,
    );

    const selector = screen.getByLabelText('Equipo');
    expect(within(selector).getByRole('option', { name: 'CM-003' })).toBeTruthy();
    expect(within(selector).queryByRole('option', { name: 'CA-011' })).toBeNull();
    expect(screen.getByText(/1 equipo está con turno en curso/)).toBeTruthy();
  });
});
