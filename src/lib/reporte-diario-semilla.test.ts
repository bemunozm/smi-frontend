import { describe, expect, it } from 'vitest';

import type { ReporteDiario } from '../types/reporte-diario';
import { semillaDeReporte } from './reporte-diario-semilla';

const reporte = (
  id: string,
  fecha: string,
  turno: ReporteDiario['turno'],
  supervisorId: string,
  jefe: string,
  producto = '',
): ReporteDiario => ({
  id,
  fecha: `${fecha}T00:00:00.000Z`,
  turno,
  supervisorId,
  supervisorNombre: supervisorId,
  observaciones: null,
  createdAt: '',
  updatedAt: '',
  produccion: [],
  tolvas: [],
  plantas: producto ? [{ plantaId: 'pp1', producto, planta: { nombre: 'P.P.1' } }] : [],
  traspasos: [],
  empresas: [],
  personal: jefe ? [{ rol: 'Jefe de turno mina', nombre: jefe, orden: 0 }] : [],
});

describe('semillaDeReporte', () => {
  const REPORTES = [
    reporte('a', '2026-11-04', 'DIURNO', 'yo', 'Álvaro', 'Sal fina'),
    reporte('b', '2026-11-05', 'DIURNO', 'yo', 'Bruno', 'Sal gruesa'),
    reporte('c', '2026-11-05', 'NOCTURNO', 'otro', 'Carla'),
    reporte('d', '2026-11-06', 'NOCTURNO', 'yo', 'Diego'),
  ];

  it('toma el reporte propio más reciente ANTERIOR al turno que se carga', () => {
    expect(semillaDeReporte(REPORTES, 'yo', '2026-11-06', 'DIURNO')).toEqual({
      desde: { fecha: '2026-11-05', turno: 'DIURNO' },
      personal: { 'Jefe de turno mina': 'Bruno' },
      productos: { pp1: 'Sal gruesa' },
    });
  });

  it('el diurno del mismo día va antes que el nocturno', () => {
    expect(semillaDeReporte(REPORTES, 'yo', '2026-11-06', 'NOCTURNO')?.desde.fecha).toBe('2026-11-05');
    expect(semillaDeReporte(REPORTES, 'yo', '2026-11-07', 'DIURNO')?.desde).toEqual({
      fecha: '2026-11-06',
      turno: 'NOCTURNO',
    });
  });

  it('no usa reportes de otro supervisor ni reportes sin personal ni plantas', () => {
    expect(semillaDeReporte(REPORTES, 'otro', '2026-11-05', 'NOCTURNO')).toBeNull();
    expect(
      semillaDeReporte([reporte('x', '2026-11-05', 'DIURNO', 'yo', '')], 'yo', '2026-11-06', 'DIURNO'),
    ).toBeNull();
    expect(semillaDeReporte(REPORTES, undefined, '2026-11-06', 'DIURNO')).toBeNull();
  });
});
