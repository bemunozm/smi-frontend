import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, cleanup, screen, fireEvent, within } from '@testing-library/react';

import { calcularTotales, totalesDeSecciones } from '../lib/reporte-diario';
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

describe('calcularTotales', () => {
  it('suma los camiones de las tres secciones', () => {
    expect(calcularTotales(SECCIONES).camiones).toBe(15);
  });

  /**
   * El campo de cada sección es «vueltas por camión», no el total ya sumado:
   * 8×6 + 4×5 + 3×4. Si alguien lo cambiara a una suma directa daría 15, que
   * es justo el total de camiones — de ahí que las dos cifras se prueben por
   * separado y con números que no se confundan entre sí.
   */
  it('pondera las vueltas por la cantidad de camiones de cada sección', () => {
    expect(calcularTotales(SECCIONES).vueltas).toBe(80);
  });

  it('trata un campo vacío como cero en vez de NaN', () => {
    const totales = calcularTotales({ ...SECCIONES, camionesMinera: '', vueltasMinera: '' });
    expect(totales.camiones).toBe(12);
    expect(totales.vueltas).toBe(68);
  });

  /** El formulario guarda strings en formato es-CL: «1.200» son mil doscientos. */
  it('entiende el separador de miles es-CL', () => {
    const totales = calcularTotales({
      ...SECCIONES,
      camionesInternos: '1.200',
      vueltasInternos: '1',
    });
    expect(totales.camiones).toBe(1207);
    expect(totales.vueltas).toBe(1232);
  });
});

/**
 * La misma regla que `calcularTotales`, pero sobre secciones ya numéricas —
 * es la que usa el historial, donde los turnos pasados no vienen como texto
 * de formulario. Se prueba aparte para que el día que alguien cambie la
 * ponderación no quede aplicada en una mitad de la pantalla y no en la otra.
 */
describe('totalesDeSecciones', () => {
  const SECCIONES_NUMERICAS = [
    { camiones: 5, vueltas: 6 },
    { camiones: 3, vueltas: 5 },
    { camiones: 2, vueltas: 4 },
  ];

  it('suma los camiones de todas las secciones', () => {
    expect(totalesDeSecciones(SECCIONES_NUMERICAS).camiones).toBe(10);
  });

  it('pondera las vueltas por los camiones de cada sección', () => {
    expect(totalesDeSecciones(SECCIONES_NUMERICAS).vueltas).toBe(53);
  });

  it('devuelve cero sin secciones', () => {
    expect(totalesDeSecciones([])).toEqual({ camiones: 0, vueltas: 0 });
  });
});

describe('ReporteDiarioView · producción del turno', () => {
  it('registra camiones y vueltas para cada una de las tres secciones', () => {
    render(<ReporteDiarioView />);

    for (const seccion of ['Camiones internos', 'Camiones mina-caleta', 'Camiones minera']) {
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

  it('muestra el total de vueltas ponderado por los camiones de cada sección', () => {
    render(<ReporteDiarioView />);

    expect(screen.getByText('Total camiones').parentElement?.textContent).toContain('15');
    expect(screen.getByText('Total vueltas').parentElement?.textContent).toContain('80');
  });

  it('cuenta las vueltas de las tres tolvas', () => {
    render(<ReporteDiarioView />);

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

    expect(screen.queryByText('Gonzalo Riquelme')).toBeNull();
  });

  it('abre la ventana con los turnos anteriores', () => {
    abrirHistorial();

    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(screen.getAllByText('Gonzalo Riquelme').length).toBeGreaterThan(0);
  });

  /**
   * El turno del 22/09 noche son 5×6 + 3×5 + 2×4. Si el historial dejara de
   * ponderar por camión mostraría 15, que es la suma cruda de las vueltas.
   */
  it('pondera las vueltas de cada turno pasado en la lista', () => {
    abrirHistorial();

    const tarjeta = screen.getByText('22/09 · NOCTURNO').closest('article');
    expect(tarjeta?.textContent).toContain('53');
    expect(tarjeta?.textContent).not.toContain('15');
  });

  it('abre el reporte completo del turno al pedir más detalle', () => {
    abrirHistorial();
    fireEvent.click(screen.getAllByText('Ver más detalle')[0]);

    // Se consulta DENTRO del diálogo: el formulario del turno en curso sigue
    // montado detrás y comparte varias de estas etiquetas.
    const ventana = within(screen.getByRole('dialog'));

    expect(ventana.getByRole('heading', { name: /Reporte del 22\/09\/2026 · NOCTURNO/ })).toBeTruthy();
    // Secciones, personal y plantas: el reporte entero, no solo la cabecera.
    expect(ventana.getByText('Camiones mina-caleta')).toBeTruthy();
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
