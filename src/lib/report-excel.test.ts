import { describe, expect, it } from 'vitest';

import { construirExcelReport } from './report-excel';
import type { TrabajoExtraordinario } from '../types/trabajosExtra';

const trabajo = (over: Partial<TrabajoExtraordinario> & Pick<TrabajoExtraordinario, 'id'>): TrabajoExtraordinario => ({
  equipoId: 'e1',
  operatorId: 'op_1',
  operador: 'Diego Tejerina',
  faena: 'Sima',
  turno: 'DIURNO',
  horometroInicial: 4395,
  horometroFinal: 4396,
  totalHoras: 1,
  actividades: ['REGULACION_CARGA', 'LIMPIEZA_CANCHA'],
  detalleActividades: [
    { actividad: 'REGULACION_CARGA', lugar: 'TRANSPORTE', planta: null, horas: 0.6, descripcion: 'Romana 2' },
    { actividad: 'LIMPIEZA_CANCHA', lugar: 'VARIADO', planta: null, horas: 0.4 },
  ],
  otraActividad: null,
  descripcion: 'Regulación de peso',
  observaciones: null,
  reportNumero: '4509',
  // Mediodía UTC: en cualquier huso horario razonable sigue siendo octubre.
  fecha: '2026-10-04T12:00:00.000Z',
  equipo: { internalCode: 'SEM 02' },
  registradoPor: 'Victor Araya',
  ...over,
});

/**
 * El Excel se prueba RELEYENDO el archivo generado: título, encabezado con el
 * azul de SMI y filtros, UNA FILA POR ACTIVIDAD (folio/equipo/operador/fecha
 * repetidos; horómetros y total solo en la primera fila del trabajo, para que
 * la columna Total_Horas se pueda sumar) y la fila de total del período. La
 * vista solo lo descarga (`TrabajosExtraAdminView.test` cubre el diálogo).
 */
describe('construirExcelReport', () => {
  it('arma la planilla: una fila por actividad, lugar y HM por fila, total sin duplicar', async () => {
    const blob = await construirExcelReport(
      [
        trabajo({ id: 't1' }),
        trabajo({
          id: 't2',
          turno: 'NOCTURNO',
          actividades: ['LIMPIEZA_SILOS'],
          detalleActividades: [{ actividad: 'LIMPIEZA_SILOS', lugar: 'PLANTA', planta: 'Planta 4', horas: 2.5 }],
          reportNumero: '4510',
          totalHoras: 2.5,
          descripcion: 'Limpieza Silo P4',
        }),
        // Registro anterior al desglose: sale en una sola fila, como antes.
        trabajo({
          id: 't3',
          actividades: ['SOLTAR_MATERIAL'],
          detalleActividades: null,
          reportNumero: null,
          totalHoras: 3,
        }),
      ],
      '2026-10-01',
      '2026-10-31',
    );

    // Misma vía de interop que el propio helper.
    const excel = await import('exceljs');
    const Workbook = excel.Workbook ?? excel.default.Workbook;
    const wb = new Workbook();
    await wb.xlsx.load(await blob.arrayBuffer());
    const ws = wb.getWorksheet('Report')!;

    // Título y subtítulo con el rango.
    expect(ws.getCell('A1').value).toBe('Report · Trabajos extraordinarios');
    expect(String(ws.getCell('A2').value)).toContain('Del 01-10-2026 al 31-10-2026');
    expect(String(ws.getCell('A2').value)).toContain('3 trabajos');

    // Encabezado: azul del shell de SMI, texto blanco y filtros.
    expect(ws.getCell('A4').value).toBe('Item');
    expect(ws.getCell('K4').value).toBe('HM_Act');
    expect(ws.getCell('N4').value).toBe('Total_Horas');
    expect(ws.getCell('A4').fill).toMatchObject({ fgColor: { argb: 'FF1E293B' } });
    expect(ws.getCell('A4').font).toMatchObject({ bold: true, color: { argb: 'FFFFFFFF' } });
    expect(ws.autoFilter).toBeTruthy();

    // t1, primera fila del desglose: todo el trabajo + su primera actividad.
    expect(ws.getCell('A5').value).toBe('Día');
    expect(String(ws.getCell('B5').value)).toContain('-10-2026');
    expect(ws.getCell('C5').value).toBe('Sima');
    expect(ws.getCell('D5').value).toBe('SEM 02');
    expect(ws.getCell('E5').value).toBe('Victor Araya');
    expect(ws.getCell('F5').value).toBe('Diego Tejerina');
    expect(ws.getCell('G5').value).toBe('4509');
    expect(ws.getCell('H5').value).toBe('Transporte');
    expect(ws.getCell('I5').value).toBe('Regulación y carga');
    expect(ws.getCell('J4').value).toBe('Detalle actividad');
    expect(ws.getCell('J5').value).toBe('Romana 2');
    expect(ws.getCell('K5').value).toBeCloseTo(0.6);
    expect(ws.getCell('N5').value).toBe(1);

    // t1, segunda actividad: folio/equipo/operador repetidos, lugar y HM
    // propios, y el total del trabajo VACÍO (no se duplica al sumar).
    expect(ws.getCell('G6').value).toBe('4509');
    expect(ws.getCell('D6').value).toBe('SEM 02');
    expect(ws.getCell('H6').value).toBe('Variado');
    expect(ws.getCell('I6').value).toBe('Limpieza de cancha');
    expect(ws.getCell('K6').value).toBeCloseTo(0.4);
    expect(ws.getCell('N6').value == null || ws.getCell('N6').value === '').toBe(true);

    // t2: la fila PLANTA muestra la planta concreta, y lleva cebra (por trabajo).
    expect(ws.getCell('A7').value).toBe('Noche');
    expect(ws.getCell('G7').value).toBe('4510');
    expect(ws.getCell('H7').value).toBe('Planta 4');
    expect(ws.getCell('K7').value).toBeCloseTo(2.5);
    expect(ws.getCell('A7').fill).toMatchObject({ fgColor: { argb: 'FFF1F5F9' } });
    // Las filas de t1 (trabajo par) no llevan cebra.
    expect(ws.getCell('A6').fill?.type === 'pattern' ? ws.getCell('A6').fill : undefined).not.toMatchObject({
      fgColor: { argb: 'FFF1F5F9' },
    });

    // t3 legacy: una sola fila, actividades juntas y sin HM por actividad.
    expect(ws.getCell('I8').value).toBe('Soltar material');
    expect(ws.getCell('H8').value == null || ws.getCell('H8').value === '').toBe(true);
    expect(ws.getCell('K8').value == null || ws.getCell('K8').value === '').toBe(true);
    expect(ws.getCell('N8').value).toBe(3);

    // Fila de total del período: suma de los TRABAJOS (1 + 2.5 + 3).
    expect(ws.getCell('I9').value).toBe('Total horas del período');
    expect(ws.getCell('N9').value).toBeCloseTo(6.5);
  }, 30_000);
});
