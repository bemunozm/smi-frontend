import { describe, expect, it } from 'vitest';

import { aReporteAnterior } from './reporte-diario';
import type { ReporteDiario } from '../types/reporte-diario';

const base: ReporteDiario = {
  id: 'r1',
  fecha: '2026-10-14T00:00:00.000Z',
  turno: 'NOCTURNO',
  supervisorId: 'u1',
  supervisorNombre: 'Ana Soto',
  observaciones: null,
  createdAt: '',
  updatedAt: '',
  produccion: [
    { seccion: 'MINERAS', camiones: 30, vueltasPorCamion: 1 },
    { seccion: 'INTERNOS', camiones: 5, vueltasPorCamion: 4 },
  ],
  tolvas: [{ tolva: 3, cargas: 7 }, { tolva: 1, cargas: 2 }],
  plantas: [{ plantaId: 'p1', producto: 'Sal fina', planta: { nombre: 'P.P.1' } }],
  traspasos: [{ tipo: 'MINA_PUERTO', cantidad: 4 }],
  empresas: [{ empresaId: 'e1', empresa: { nombre: 'Hyd' } }],
  personal: [{ rol: 'HSE', nombre: 'Dani', orden: 0 }],
};

describe('aReporteAnterior', () => {
  it('ordena las secciones canónicamente y rellena la faltante con 0', () => {
    const r = aReporteAnterior(base);
    expect(r.secciones).toEqual([
      { label: 'Camiones internos', camiones: 5, vueltas: 4 },
      { label: 'Camiones Mina Caleta', camiones: 0, vueltas: 0 },
      { label: 'Camiones mineras', camiones: 30, vueltas: 1 },
    ]);
  });

  it('rellena las tolvas faltantes con 0 y las ordena', () => {
    expect(aReporteAnterior(base).tolvas).toEqual([2, 0, 7]);
  });

  it('conserva el id, la fecha local y mapea el resto', () => {
    const r = aReporteAnterior(base);
    expect(r.id).toBe('r1');
    expect([r.fecha.getFullYear(), r.fecha.getMonth(), r.fecha.getDate()]).toEqual([2026, 9, 14]);
    expect(r.supervisor).toBe('Ana Soto');
    expect(r.plantas).toEqual([['P.P.1', 'Sal fina']]);
    expect(r.traspasos).toEqual([['Equipos Mina-Puerto', '4']]);
    expect(r.empresas).toEqual(['Hyd']);
    expect(r.personal).toEqual([['HSE', 'Dani']]);
  });

  it('conserva los ids de plantas y empresas y el tipo de cada traspaso', () => {
    const r = aReporteAnterior(base);
    expect(r.productosPorPlantaId).toEqual({ p1: 'Sal fina' });
    expect(r.plantaIds).toEqual(['p1']);
    expect(r.empresaIds).toEqual(['e1']);
    expect(r.traspasoTipos).toEqual(['MINA_PUERTO']);
  });
});
