import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup, screen } from '@testing-library/react';

import { calcularTotales } from '../lib/reporte-diario';
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

describe('ReporteDiarioView · producción del turno', () => {
  it('registra camiones y vueltas para cada una de las tres secciones', () => {
    render(<ReporteDiarioView />);

    for (const seccion of ['Camiones internos', 'Camiones mina-caleta', 'Camiones minera']) {
      expect(screen.getByText(seccion)).toBeTruthy();
    }
    expect(screen.getAllByText('Vueltas por camión')).toHaveLength(3);
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
