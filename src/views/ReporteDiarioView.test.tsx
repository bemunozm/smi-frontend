import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, cleanup, screen, fireEvent, within } from '@testing-library/react';

const { PLANTAS_MOCK, EMPRESAS_MOCK, TARJETAS_MOCK, REPORTES_MOCK, MUTATE } = vi.hoisted(() => ({
  MUTATE: vi.fn(),
  REPORTES_MOCK: [
    {
      id: 'r-noche',
      fecha: '2026-09-22',
      turno: 'NOCTURNO',
      supervisorId: 'u2',
      supervisorNombre: 'José Pérez',
      observaciones: null,
      createdAt: '',
      updatedAt: '',
      produccion: [
        { seccion: 'INTERNOS', camiones: 5, vueltasPorCamion: 4 },
        { seccion: 'MINA_CALETA', camiones: 16, vueltasPorCamion: 3 },
        { seccion: 'MINERAS', camiones: 34, vueltasPorCamion: 1 },
      ],
      tolvas: [{ tolva: 1, cargas: 1 }, { tolva: 2, cargas: 2 }, { tolva: 3, cargas: 3 }],
      plantas: [{ plantaId: 'pl1', producto: 'Rechazo a acopio', planta: { nombre: 'P.R.2' } }],
      traspasos: [{ tipo: 'INTERNOS', cantidad: 3 }],
      empresas: [{ empresaId: 'em1', empresa: { nombre: 'Hyd' } }],
      personal: [{ rol: 'Jefe de turno transporte', nombre: 'Nelson Cáceres', orden: 0 }],
    },
    {
      id: 'r-dia',
      fecha: '2026-09-22',
      turno: 'DIURNO',
      supervisorId: 'u1',
      supervisorNombre: 'Limbert Villacorta',
      observaciones: null,
      createdAt: '',
      updatedAt: '',
      produccion: [{ seccion: 'INTERNOS', camiones: 6, vueltasPorCamion: 5 }],
      tolvas: [],
      plantas: [],
      traspasos: [],
      empresas: [],
      personal: [],
    },
  ],
  PLANTAS_MOCK: [
    { id: 'pl1', nombre: 'P.P.1', orden: 1, activa: true },
    { id: 'pl2', nombre: 'Planta P.P.E', orden: 2, activa: true },
  ],
  EMPRESAS_MOCK: [
    { id: 'em1', nombre: 'Hyd', orden: 1, activa: true },
    { id: 'em2', nombre: 'Sijam', orden: 2, activa: true },
  ],
  TARJETAS_MOCK: [
    { id: 'c1', operatorName: 'Patricio Rojas', equipo: { internalCode: 'CG-002' }, closedAt: null },
    { id: 'c2', operatorName: 'Marcelo Soto', equipo: { internalCode: 'EX-001' }, closedAt: '2026-09-23T10:00:00Z' },
  ],
}));
vi.mock('../hooks/useReporteDiario', () => ({
  usePlantas: () => ({ data: PLANTAS_MOCK }),
  useEmpresasExternas: () => ({ data: EMPRESAS_MOCK }),
  useReportesDiarios: () => ({ data: REPORTES_MOCK }),
  useCreateReporteDiario: () => ({ mutate: MUTATE, isPending: false }),
}));
vi.mock('../hooks/useShiftCards', () => ({
  useShiftCardsMine: () => ({ data: TARJETAS_MOCK }),
}));

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

  /** Un conteo no tiene decimales: no existen 2,5 camiones. */
  it.each(['2.5', '2,5'])('%s no es un conteo válido y vale cero', (camiones) => {
    const [internos] = seccionesDelFormulario({ ...SECCIONES, camionesInternos: camiones, vueltasInternos: '4' });
    expect(vueltasDeSeccion(internos)).toBe(0);
  });

  it('un texto que no es un número vale cero', () => {
    const [internos] = seccionesDelFormulario({ ...SECCIONES, camionesInternos: 'abc', vueltasInternos: '4' });
    expect(vueltasDeSeccion(internos)).toBe(0);
  });
});

describe('ReporteDiarioView · catálogos y operadores reales', () => {
  it('lista las plantas y empresas del catálogo y solo los operadores con tarjeta abierta', () => {
    render(<ReporteDiarioView />);

    expect(screen.getByLabelText('Producto de P.P.1')).toBeTruthy();
    expect(screen.getByLabelText('Producto de Planta P.P.E')).toBeTruthy();
    expect(screen.getByText('Hyd')).toBeTruthy();
    expect(screen.getByText('Sijam')).toBeTruthy();
    expect(screen.queryByText('Spence')).toBeNull();
    expect(screen.getByText('Patricio Rojas')).toBeTruthy();
    expect(screen.queryByText('Marcelo Soto')).toBeNull();
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

  it('"1.200" camiones son 1200 y no avisa de agrupación; un decimal marca error', () => {
    render(<ReporteDiarioView />);

    const [camionesInternos] = screen.getAllByLabelText('Cantidad de camiones');
    fireEvent.change(camionesInternos, { target: { value: '1.200' } });
    expect(screen.getByText('Internos').parentElement?.textContent).toContain('6.000');
    expect(screen.queryByText(/Se guardará/)).toBeNull();
    expect(screen.queryByText('Escribí un número entero, sin decimales.')).toBeNull();

    fireEvent.change(camionesInternos, { target: { value: '2,5' } });
    expect(screen.getByText('Escribí un número entero, sin decimales.')).toBeTruthy();
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
   * El historial son los reportes que devuelve el servidor, del turno más
   * reciente al más viejo (el nocturno del 22/09 va antes que su diurno).
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
    expect(screen.getAllByText('Ver más detalle')).toHaveLength(2);
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
    expect(screen.getAllByText('Ver más detalle').length).toBe(2);
  });
});

/**
 * La corrección de un reporte enviado la conecta al PATCH la tarea siguiente:
 * mientras tanto el botón queda deshabilitado, sin romper el detalle real.
 */
describe('ReporteDiarioView · corregir un reporte enviado', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 8, 23, 14, 0));
  });
  afterEach(() => vi.useRealTimers());

  it('el detalle de un reporte real se abre y su botón Editar está deshabilitado', () => {
    render(<ReporteDiarioView />);
    fireEvent.click(screen.getByText('Ver historial de reportes'));
    fireEvent.click(screen.getAllByText('Ver más detalle')[0]);

    const ventana = within(screen.getByRole('dialog'));
    expect((ventana.getByRole('button', { name: /Editar/ }) as HTMLButtonElement).disabled).toBe(true);
  });
});

describe('ReporteDiarioView · enviar el reporte', () => {
  beforeEach(() => {
    MUTATE.mockClear();
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 8, 23, 14, 0));
  });
  afterEach(() => vi.useRealTimers());

  it('arma el reporte con las secciones en orden, solo las plantas con producto y las empresas marcadas', () => {
    render(<ReporteDiarioView />);
    fireEvent.change(screen.getByLabelText('Producto de P.P.1'), { target: { value: 'Sal fina' } });
    fireEvent.click(screen.getByText('Sijam'));
    fireEvent.click(screen.getByRole('button', { name: /Enviar reporte diario/ }));

    expect(MUTATE).toHaveBeenCalledTimes(1);
    const input = MUTATE.mock.calls[0][0];
    expect(input.fecha).toBe('2026-09-23');
    expect(input.turno).toBe('DIURNO');
    expect(input.produccion.map((p: { seccion: string }) => p.seccion)).toEqual(['INTERNOS', 'MINA_CALETA', 'MINERAS']);
    expect(input.produccion[1]).toEqual({ seccion: 'MINA_CALETA', camiones: 18, vueltasPorCamion: 3 });
    expect(input.tolvas).toEqual([
      { tolva: 1, cargas: 2 },
      { tolva: 2, cargas: 2 },
      { tolva: 3, cargas: 4 },
    ]);
    expect(input.plantas).toEqual([{ plantaId: 'pl1', producto: 'Sal fina' }]);
    expect(input.empresaIds).toEqual(['em2']);
    expect(input.traspasos.map((t: { tipo: string }) => t.tipo)).toEqual(['INTERNOS', 'EXTERNOS', 'MINA_PUERTO']);
    expect(input.personal).toHaveLength(4);
  });
});
