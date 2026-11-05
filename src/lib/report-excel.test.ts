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
  actividades: ['REGULACION_CARGA'],
  otraActividad: null,
  descripcion: 'Regulación de peso',
  observaciones: null,
  reportNumero: '4509',
  destino: 'TRANSPORTE',
  planta: null,
  // Mediodía UTC: en cualquier huso horario razonable sigue siendo octubre.
  fecha: '2026-10-04T12:00:00.000Z',
  equipo: { internalCode: 'SEM 02' },
  registradoPor: 'Victor Araya',
  ...over,
});

/**
 * El Excel se prueba RELEYENDO el archivo generado: título, encabezado con el
 * azul de SMI y filtros, las filas con los datos de la planilla del cliente y
 * la fila de total del período. La vista solo lo descarga
 * (`TrabajosExtraAdminView.test` cubre el diálogo del período).
 */
describe('construirExcelReport', () => {
  it('arma la planilla del cliente con formato, cebra y total del período', async () => {
    const blob = await construirExcelReport(
      [
        trabajo({ id: 't1' }),
        trabajo({
          id: 't2',
          turno: 'NOCTURNO',
          actividades: ['LIMPIEZA_SILOS'],
          destino: 'PLANTA',
          planta: 'Planta 4',
          reportNumero: '4510',
          totalHoras: 2.5,
          descripcion: 'Limpieza Silo P4',
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
    expect(String(ws.getCell('A2').value)).toContain('2 trabajos');

    // Encabezado: azul del shell de SMI, texto blanco y filtros.
    expect(ws.getCell('A4').value).toBe('Item');
    expect(ws.getCell('L4').value).toBe('Total_Horas');
    expect(ws.getCell('A4').fill).toMatchObject({ fgColor: { argb: 'FF1E293B' } });
    expect(ws.getCell('A4').font).toMatchObject({ bold: true, color: { argb: 'FFFFFFFF' } });
    expect(ws.autoFilter).toBeTruthy();

    // Primera fila de datos: las columnas de la planilla del cliente.
    expect(ws.getCell('A5').value).toBe('Día');
    expect(String(ws.getCell('B5').value)).toContain('-10-2026');
    expect(ws.getCell('C5').value).toBe('Sima');
    expect(ws.getCell('D5').value).toBe('SEM 02');
    expect(ws.getCell('E5').value).toBe('Victor Araya');
    expect(ws.getCell('F5').value).toBe('Diego Tejerina');
    expect(ws.getCell('G5').value).toBe('4509');
    expect(ws.getCell('H5').value).toBe('Transporte');
    expect(ws.getCell('I5').value).toBe('Regulación y carga');
    expect(ws.getCell('L5').value).toBe(1);

    // Segunda fila: destino PLANTA muestra la planta concreta, y lleva cebra.
    expect(ws.getCell('A6').value).toBe('Noche');
    expect(ws.getCell('G6').value).toBe('4510');
    expect(ws.getCell('H6').value).toBe('Planta 4');
    expect(ws.getCell('A6').fill).toMatchObject({ fgColor: { argb: 'FFF1F5F9' } });

    // Fila de total del período.
    expect(ws.getCell('I7').value).toBe('Total horas del período');
    expect(ws.getCell('L7').value).toBeCloseTo(3.5);
  }, 30_000);
});
