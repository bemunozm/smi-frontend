import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup, screen, fireEvent } from '@testing-library/react';
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
          actividades: ['REGULACION_CARGA'],
          otraActividad: null,
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
   * Una salida suele mezclar tareas, así que las actividades son varias. Y
   * «Otro» sin texto dejaría la actividad como «otro» a secas: el trabajo no
   * se podría justificar ni cobrar, así que el campo aparece solo al elegirlo.
   */
  it('permite elegir varias actividades y pide el texto al marcar Otro', () => {
    const qc = new QueryClient();
    qc.setQueryData(['equipment'], [{ id: 'e1', internalCode: 'CM-003', type: 'Camión' }]);
    qc.setQueryData(['trabajos-extra'], []);
    qc.setQueryData(['horometro'], []);

    render(
      <QueryClientProvider client={qc}>
        <TrabajosExtraView />
      </QueryClientProvider>,
    );

    // El campo de texto no está hasta que se elige «Otro».
    expect(screen.queryByLabelText(/otra actividad/i)).toBeNull();

    const soltar = screen.getByRole('button', { name: 'Soltar material' });
    const limpiar = screen.getByRole('button', { name: 'Limpieza de cancha' });
    fireEvent.click(soltar);
    fireEvent.click(limpiar);

    // Las dos quedan marcadas a la vez: no es excluyente.
    expect(soltar.getAttribute('aria-pressed')).toBe('true');
    expect(limpiar.getAttribute('aria-pressed')).toBe('true');

    fireEvent.click(screen.getByRole('button', { name: 'Otro' }));
    expect(screen.getByLabelText(/otra actividad/i)).toBeTruthy();
  });
});
