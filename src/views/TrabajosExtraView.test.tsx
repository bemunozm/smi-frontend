import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, cleanup, screen, within, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TrabajosExtraView } from './TrabajosExtraView';

afterEach(cleanup);

const REGISTRO = {
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
  observaciones: 'Neumático trasero pinchado a media tarea',
  fecha: '2026-08-01T09:00:00.000Z',
  equipo: { internalCode: 'CM-003' },
};

function renderConRegistro() {
  const qc = new QueryClient();
  qc.setQueryData(['equipment'], [{ id: 'e1', internalCode: 'CM-003', type: 'Camión' }]);
  qc.setQueryData(['trabajos-extra'], [REGISTRO]);
  qc.setQueryData(['horometro'], []);
  return render(
    <QueryClientProvider client={qc}>
      <TrabajosExtraView />
    </QueryClientProvider>,
  );
}

describe('TrabajosExtraView', () => {
  afterEach(() => vi.useRealTimers());

  it('renderiza con datos sin lanzar', () => {
    renderConRegistro();

    expect(screen.getByRole('heading', { name: 'Trabajos extraordinarios' })).toBeTruthy();
    expect(screen.getByText('Registrar trabajo')).toBeTruthy();
  });

  /**
   * Los trabajos ya registrados viven en una ventana, como el historial de
   * Reporte diario: no están a la vista hasta abrirla.
   */
  it('muestra los trabajos registrados en la ventana del historial', () => {
    renderConRegistro();

    expect(screen.queryByText(/Rajo Norte/)).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /Ver historial de trabajos/ }));

    const ventana = within(screen.getByRole('dialog'));
    // La faena del registro histórico se muestra tal como quedó guardada,
    // aunque el formulario ya solo ofrezca Patillo y Kainita.
    expect(ventana.getByText(/Rajo Norte/)).toBeTruthy();
    expect(ventana.getByText('Regulación y carga')).toBeTruthy();
  });

  it('abre el detalle de un trabajo con su descripción y observaciones', () => {
    renderConRegistro();

    fireEvent.click(screen.getByRole('button', { name: /Ver historial de trabajos/ }));
    fireEvent.click(screen.getByRole('button', { name: /Ver detalle/ }));

    const ventana = within(screen.getByRole('dialog'));
    expect(ventana.getByText('Carga de material')).toBeTruthy();
    expect(ventana.getByText('Neumático trasero pinchado a media tarea')).toBeTruthy();

    fireEvent.click(ventana.getByText('Volver al historial'));
    expect(within(screen.getByRole('dialog')).getByRole('button', { name: /Ver detalle/ })).toBeTruthy();
  });

  /** El turno lo propone el reloj: de noche ya no arranca en DIURNO. */
  it('propone el turno que corre según la hora', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 8, 28, 22, 30));
    renderConRegistro();

    const turno = within(screen.getByRole('group', { name: 'Turno' }));
    expect(turno.getByRole('button', { name: /NOCTURNO/ }).getAttribute('aria-pressed')).toBe('true');
    expect(turno.getByRole('button', { name: /DIURNO/ }).getAttribute('aria-pressed')).toBe('false');
  });

  /**
   * Un equipo con turno en curso está ocupado: sus horas todavía no están
   * cerradas, así que las del trabajo extraordinario podrían terminar
   * contadas dos veces. El servidor lo rechaza; la vista además lo muestra en
   * gris, para que se sepa que el equipo existe y por qué no se puede elegir.
   */
  it('muestra los equipos en turno como ocupados y no deja elegirlos', () => {
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

    fireEvent.click(screen.getByLabelText('Equipo'));
    const lista = within(screen.getByRole('listbox'));

    // El libre se puede elegir.
    const libre = lista.getByRole('option', { name: /CM-003/ });
    expect(libre.getAttribute('aria-disabled')).not.toBe('true');

    // El ocupado sigue a la vista —para que se sepa que existe— pero
    // deshabilitado y diciendo por qué.
    const ocupado = lista.getByRole('option', { name: /CA-011/ });
    expect(ocupado.getAttribute('aria-disabled')).toBe('true');
    expect(ocupado.textContent).toContain('Ocupado, en turno');

    expect(screen.getByText(/1 equipo está en turno/)).toBeTruthy();
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
