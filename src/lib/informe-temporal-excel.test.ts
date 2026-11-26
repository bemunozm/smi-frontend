import { describe, expect, it } from 'vitest';

import { construirExcelInformesTemporales } from './informe-temporal-excel';
import type { InformeTemporal, InformeTemporalTarjeta } from '../types/informe-temporal';

const tarjeta = (id: string, code: string, ini: number, fin: number | null, litros: number | null) =>
  ({
    id,
    equipo: { id: `e-${id}`, internalCode: code, name: 'Excavadora' },
    operador: 'Juan',
    valorInicial: ini,
    valorFinal: fin,
    fuelLiters: litros,
    adBlueLiters: null,
    pumpPhotoUrl: null,
    fecha: '2026-11-20T12:00:00.000Z',
    fechaSalida: null,
  }) satisfies InformeTemporalTarjeta;

const informe = (over: Partial<InformeTemporal> & Pick<InformeTemporal, 'id' | 'numero'>): InformeTemporal => ({
  antiguo: false,
  equiposRegistrados: [],
  fecha: '2026-11-20',
  turno: 'DIURNO',
  actividad1: 'Carga de material',
  actividad2: null,
  personal: [],
  observaciones: null,
  supervisorResponsable1: 'Ana',
  supervisorResponsable2: null,
  supervisorId: 's1',
  supervisorNombre: 'Ana Soto',
  inicio: '2026-11-20T10:00:00.000Z',
  fin: '2026-11-20T20:00:00.000Z',
  createdAt: '2026-11-20T20:00:00.000Z',
  updatedAt: '2026-11-20T20:00:00.000Z',
  tarjetas: [],
  ...over,
});

describe('construirExcelInformesTemporales', () => {
  it('una fila por tarjeta, con los encabezados del informe', async () => {
    const buffer = await construirExcelInformesTemporales([
      informe({
        id: 'i1',
        numero: 7,
        actividad2: 'Despeje',
        supervisorResponsable2: 'Pedro Soto',
        observaciones: 'Sin novedades',
        personal: [
          { actividad: 1, operatorId: 'op1', nombre: 'Luis' },
          { actividad: 1, operatorId: null, nombre: 'Pedro' },
          { actividad: 2, operatorId: null, nombre: 'Rosa' },
        ],
        tarjetas: [
          { ...tarjeta('a', 'EX-1', 100, 108.5, 40), adBlueLiters: 3.5 },
          tarjeta('b', 'CG-2', 200, 203, null),
          tarjeta('c', 'SEM-3', 50, 51, 12),
        ],
      }),
      informe({ id: 'i2', numero: 8, turno: 'NOCTURNO', tarjetas: [tarjeta('d', 'EX-9', 10, 12, 5)] }),
    ]);

    const excel = await import('exceljs');
    const Workbook = excel.Workbook ?? excel.default.Workbook;
    const wb = new Workbook();
    await wb.xlsx.load(buffer);
    const ws = wb.worksheets[0]!;

    const encabezado = (ws.getRow(1).values as unknown[]).slice(1);
    expect(encabezado).toEqual([
      'N°',
      'Fecha',
      'Turno',
      'Supervisor',
      'Actividad 1',
      'Actividad 2',
      'Equipo',
      'Lectura inicial',
      'Lectura final',
      'Total',
      'Combustible (L)',
      'Personal act. 1',
      'Personal act. 2',
      'Observaciones',
      'Supervisor responsable 1',
      'Supervisor responsable 2',
      'AdBlue (L)',
      'Subido después',
    ]);
    expect(ws.rowCount).toBe(5);

    const fila = (n: number) => (ws.getRow(n).values as unknown[]).slice(1);
    expect(fila(2)).toEqual([
      7,
      '20-11-2026',
      'Diurno',
      'Ana Soto',
      'Carga de material',
      'Despeje',
      'EX-1',
      100,
      108.5,
      8.5,
      40,
      'Luis, Pedro',
      'Rosa',
      'Sin novedades',
      'Ana',
      'Pedro Soto',
      3.5,
    ]);
    expect(fila(3)[6]).toBe('CG-2');
    expect(fila(3)[10]).toBeUndefined();
    // Sin AdBlue la celda queda vacía, no en 0.
    expect(fila(3)[16]).toBeUndefined();
    expect(fila(5)[2]).toBe('Nocturno');
    expect(fila(5)[0]).toBe(8);
  });

  it('un informe subido después: una fila por equipo escrito a mano, marcado «Sí»', async () => {
    const buffer = await construirExcelInformesTemporales([
      informe({
        id: 'a1',
        numero: 1,
        antiguo: true,
        equiposRegistrados: [
          { equipoId: 'e1', codigo: 'COMPRESOR', nombre: 'Compresor', unidad: 'h', inicial: 484.92, final: 487.1, litros: null },
          { equipoId: 'e2', codigo: 'SEM 02', nombre: 'Cargador', unidad: 'h', inicial: 4713, final: 4720, litros: 30 },
        ],
      }),
    ]);
    const excel = await import('exceljs');
    const Workbook = excel.Workbook ?? excel.default.Workbook;
    const wb = new Workbook();
    await wb.xlsx.load(buffer);
    const ws = wb.worksheets[0]!;
    const fila = (n: number) => (ws.getRow(n).values as unknown[]).slice(1);
    expect(ws.rowCount).toBe(3);
    expect(fila(2).slice(6, 11)).toEqual(['COMPRESOR', 484.92, 487.1, 2.18, undefined]);
    expect(fila(3).slice(6, 11)).toEqual(['SEM 02', 4713, 4720, 7, 30]);
    expect(fila(2)[17]).toBe('Sí');
  });
});
