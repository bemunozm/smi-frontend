import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, cleanup, screen, fireEvent, within } from '@testing-library/react';

import { seccionesDelFormulario, vueltasDeSeccion } from '../lib/reporte-diario';
import { ReporteDiarioView } from './ReporteDiarioView';

afterEach(cleanup);

/** Los tres campos de camiones con sus vueltas, como los tiene el formulario. */
const SECCIONES = {
  camionesInternos: '8',
  vueltasInternos: '6',
  camionesMinaCaleta: '4',
  vueltasMinaCaleta: '5',
  camionesMinera: '3',
  vueltasMinera: '4',
};

/**
 * El campo de cada sección es «vueltas por camión», no el total ya sumado.
 * Y cada sección es su propio contador: cada tipo de camión tiene tarifa
 * distinta (Acta N.° 004, R9), así que no hay un total que las sume.
 */
describe('vueltasDeSeccion', () => {
  it('pondera las vueltas por la cantidad de camiones', () => {
    expect(vueltasDeSeccion({ camiones: 8, vueltas: 6 })).toBe(48);
  });

  it('vale cero sin camiones', () => {
    expect(vueltasDeSeccion({ camiones: 0, vueltas: 6 })).toBe(0);
  });
});

describe('seccionesDelFormulario', () => {
  it('lee las tres secciones en orden: internos, Mina Caleta, mineras', () => {
    expect(seccionesDelFormulario(SECCIONES).map(vueltasDeSeccion)).toEqual([48, 20, 12]);
  });

  it('trata un campo vacío como cero en vez de NaN', () => {
    const [, , mineras] = seccionesDelFormulario({ ...SECCIONES, camionesMinera: '', vueltasMinera: '' });
    expect(vueltasDeSeccion(mineras)).toBe(0);
  });

  /** El formulario guarda strings en formato es-CL: «1.200» son mil doscientos. */
  it('entiende el separador de miles es-CL', () => {
    const [internos] = seccionesDelFormulario({ ...SECCIONES, camionesInternos: '1.200', vueltasInternos: '1' });
    expect(vueltasDeSeccion(internos)).toBe(1200);
  });
});

describe('ReporteDiarioView · producción del turno', () => {
  it('registra camiones y vueltas para cada una de las tres secciones', () => {
    render(<ReporteDiarioView />);

    for (const seccion of ['Camiones internos', 'Camiones Mina Caleta', 'Camiones mineras']) {
      expect(screen.getByText(seccion)).toBeTruthy();
    }
    expect(screen.getAllByText('Cantidad de camiones')).toHaveLength(3);
    expect(screen.getAllByText('Vueltas por camión')).toHaveLength(3);
  });

  /**
   * La faena la dice la cabecera de la ficha. Llegó a estar también en los
   * chips del título, mostrándola dos veces en la misma pantalla.
   */
  it('nombra la faena una sola vez en la pantalla', () => {
    render(<ReporteDiarioView />);

    expect(screen.getAllByText('Faena Patillo')).toHaveLength(1);
  });

  /**
   * R9: un contador por tipo de camión y ningún total que los sume. Con los
   * valores iniciales del formulario: internos 5×5, Mina Caleta 18×3 y
   * mineras 38×1.
   */
  it('lleva un contador de vueltas independiente por tipo de camión', () => {
    render(<ReporteDiarioView />);

    expect(screen.getByText('Internos').parentElement?.textContent).toContain('25');
    expect(screen.getByText('Mina Caleta').parentElement?.textContent).toContain('54');
    expect(screen.getByText('Mineras').parentElement?.textContent).toContain('38');
    expect(screen.queryByText('Total vueltas')).toBeNull();
  });

  it('recalcula el contador de la sección al cambiar sus camiones', () => {
    render(<ReporteDiarioView />);

    const [camionesInternos] = screen.getAllByLabelText('Cantidad de camiones');
    fireEvent.change(camionesInternos, { target: { value: '8' } });

    expect(screen.getByText('Internos').parentElement?.textContent).toContain('40');
  });

  /** Acta N.° 004, punto 3: «vueltas por tolva» pasa a «Alimentación Planta PPE». */
  it('registra la alimentación de la planta PPE por tolva', () => {
    render(<ReporteDiarioView />);

    expect(screen.getByText('Alimentación Planta PPE')).toBeTruthy();
    expect(screen.queryByText('Vueltas por tolva')).toBeNull();
    for (const tolva of ['Tolva 1', 'Tolva 2', 'Tolva 3']) {
      expect(screen.getByText(tolva)).toBeTruthy();
    }
  });

  it('ya no pide tonelaje, carga piso/planta ni las horas del report', () => {
    render(<ReporteDiarioView />);

    for (const retirado of [
      'Tonelaje estimado',
      'Carga de piso vs. carga de planta',
      'N.º de report',
      'Horas del report',
    ]) {
      expect(screen.queryByText(retirado)).toBeNull();
    }
  });

  /**
   * El turno, la fecha y el supervisor abren la pantalla. Antes cerraban el
   * formulario, así que se compara la posición en el DOM y no la mera
   * presencia: si alguien los devuelve al final, esto falla.
   */
  it('muestra turno, fecha y supervisor antes del primer bloque del formulario', () => {
    render(<ReporteDiarioView />);

    const turno = screen.getByText('Turno');
    const personal = screen.getByRole('heading', { name: 'Personal del turno' });

    expect(turno.compareDocumentPosition(personal) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});

/**
 * Turno, fecha y supervisor ya no están escritos en la pantalla: salen del
 * reloj y de la sesión con la misma regla que Registro de equipo. Solo se
 * finge `Date` —no los timers— para no frenar el diálogo de react-aria.
 */
describe('ReporteDiarioView · cabecera de la ficha', () => {
  afterEach(() => vi.useRealTimers());

  const dato = (label: string) => screen.getByText(label).closest('div')?.textContent ?? '';

  it('a media tarde es el diurno del día del reloj', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 8, 28, 10, 25));
    render(<ReporteDiarioView />);

    expect(dato('Turno')).toContain('DIURNO · 08–20');
    expect(dato('Fecha')).toContain('28-09-2026');
  });

  /** De madrugada el turno es el nocturno que arrancó el día ANTERIOR. */
  it('de madrugada es el nocturno del día anterior', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 8, 24, 2, 14));
    render(<ReporteDiarioView />);

    expect(dato('Turno')).toContain('NOCTURNO · 20–08');
    expect(dato('Fecha')).toContain('23-09-2026');
  });
});

describe('ReporteDiarioView · historial en ventana', () => {
  /**
   * El historial son los turnos que preceden al actual, calculados desde el
   * reloj. Con el reloj a media tarde del 23/09 los cinco anteriores son del
   * 22/09 noche hacia atrás.
   */
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 8, 23, 14, 0));
  });
  afterEach(() => vi.useRealTimers());

  const abrirHistorial = () => {
    render(<ReporteDiarioView />);
    fireEvent.click(screen.getByText('Ver historial de reportes'));
  };

  it('no muestra los reportes anteriores hasta abrir la ventana', () => {
    render(<ReporteDiarioView />);

    expect(screen.queryByText('José Pérez')).toBeNull();
  });

  it('abre la ventana con los turnos anteriores', () => {
    abrirHistorial();

    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(screen.getAllByText('José Pérez').length).toBeGreaterThan(0);
  });

  /**
   * El turno del 22/09 noche son internos 5×4, Mina Caleta 16×3 y mineras
   * 34×1: un contador ponderado por tipo (20, 48 y 34), y nunca su suma (102),
   * porque cada tipo se cobra con otra tarifa.
   */
  it('muestra las vueltas de cada turno pasado por tipo de camión, sin sumarlas', () => {
    abrirHistorial();

    const tarjeta = within(screen.getByText('22/09 · NOCTURNO').closest('article')!);
    expect(tarjeta.getByText('Internos').parentElement?.textContent).toContain('20');
    expect(tarjeta.getByText('Mina Caleta').parentElement?.textContent).toContain('48');
    expect(tarjeta.getByText('Mineras').parentElement?.textContent).toContain('34');
    expect(tarjeta.queryByText('102')).toBeNull();
  });

  it('abre el reporte completo del turno al pedir más detalle', () => {
    abrirHistorial();
    fireEvent.click(screen.getAllByText('Ver más detalle')[0]);

    // Se consulta DENTRO del diálogo: el formulario del turno en curso sigue
    // montado detrás y comparte varias de estas etiquetas.
    const ventana = within(screen.getByRole('dialog'));

    expect(ventana.getByRole('heading', { name: /Reporte del 22\/09\/2026 · NOCTURNO/ })).toBeTruthy();
    // Secciones, personal y plantas: el reporte entero, no solo la cabecera.
    expect(ventana.getByText('Camiones Mina Caleta')).toBeTruthy();
    expect(ventana.getByText('Alimentación Planta PPE')).toBeTruthy();
    expect(ventana.getByText('Nelson Cáceres')).toBeTruthy();
    expect(ventana.getByText('Rechazo a acopio')).toBeTruthy();
  });

  it('vuelve del detalle a la lista sin cerrar la ventana', () => {
    abrirHistorial();
    fireEvent.click(screen.getAllByText('Ver más detalle')[0]);
    fireEvent.click(screen.getByText('Volver al historial'));

    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(screen.getAllByText('Ver más detalle').length).toBe(5);
  });
});

/**
 * Acta N.° 004, R13: un reporte ya enviado se corrige desde el historial,
 * sin autorización pero avisando al administrador, y el detalle guarda quién
 * cambió qué. Guardar sin tocar nada no es un cambio.
 */
describe('ReporteDiarioView · corregir un reporte enviado', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 8, 23, 14, 0));
  });
  afterEach(() => vi.useRealTimers());

  const abrirEdicion = () => {
    render(<ReporteDiarioView />);
    fireEvent.click(screen.getByText('Ver historial de reportes'));
    fireEvent.click(screen.getAllByText('Ver más detalle')[0]);
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: /Editar/ }));
    return () => within(screen.getByRole('dialog'));
  };

  it('abre el reporte prellenado con el aviso al administrador', () => {
    const ventana = abrirEdicion();

    expect(ventana().getByText(/Al guardar se avisa al administrador/)).toBeTruthy();
    expect((ventana().getByLabelText('Jefe de turno transporte') as HTMLInputElement).value).toBe('Nelson Cáceres');
  });

  it('guarda la corrección y la deja en el historial de cambios', () => {
    const ventana = abrirEdicion();

    fireEvent.change(ventana().getByLabelText('Jefe de turno transporte'), { target: { value: 'Claudio Bravo' } });
    fireEvent.click(ventana().getByRole('button', { name: /Guardar cambios/ }));

    expect(ventana().getByText(/Cambio guardado. Se avisó al administrador./)).toBeTruthy();
    // El detalle ya muestra el dato nuevo, y el historial el antes y el después.
    expect(ventana().getAllByText('Claudio Bravo').length).toBeGreaterThan(0);
    expect(ventana().getByText('Historial de cambios').parentElement?.textContent).toContain('1 cambio');
    expect(ventana().getByText('Nelson Cáceres')).toBeTruthy();
  });

  it('guardar sin cambiar nada no agrega un cambio', () => {
    const ventana = abrirEdicion();
    fireEvent.click(ventana().getByRole('button', { name: /Guardar cambios/ }));

    expect(ventana().queryByText(/Cambio guardado/)).toBeNull();
    expect(ventana().getByText('Sin cambios desde que se registró.')).toBeTruthy();
  });
});
