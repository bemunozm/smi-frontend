import { describe, expect, it } from 'vitest';

import { MetricasEquipoSchema, ResumenDiaSchema, ResumenHoySchema } from './dashboard';

describe('dashboard schemas', () => {
  it('parsea el resumen de hoy', () => {
    const res = ResumenHoySchema.parse({
      totales: { enUso: 1, disponibles: 2, inoperativos: 0 },
      equipos: [
        { equipmentId: 'e1', internalCode: 'CG-002', estado: 'EN_USO', status: 'OPERATIONAL', operador: 'P. Rojas', turno: 'DIURNO', supervisor: 'Limbert' },
        { equipmentId: 'e2', internalCode: 'EX-001', estado: 'DISPONIBLE', status: 'OPERATIONAL' },
      ],
    });
    expect(res.totales.enUso).toBe(1);
  });

  it('acepta rendimiento null y lo distingue de 0', () => {
    const eq = MetricasEquipoSchema.parse({
      equipmentId: 'e1',
      internalCode: 'CG-002',
      horas: 0,
      litros: 30,
      rendimiento: null,
      serieDiaria: [{ fecha: '2026-10-01', horas: 0, opero: false }],
    });
    expect(eq.rendimiento).toBeNull();
  });

  it('resumen del día: conserva el detalle de lecturas y cargas, y tolera payloads cacheados sin él', () => {
    const viejo = {
      fecha: '2026-11-13',
      hm: { total: 6, dia: 6, noche: 0 },
      diesel: { total: 40, dia: 40, noche: 0, porHm: 6.67 },
      reports: { totalHoras: 4, porEquipo: [{ internalCode: 'EX-001', horas: 4 }] },
      produccion: { internos: 0, minaCaleta: 0, mineras: 0 },
      adBlue: null,
      operacionPorEquipo: [],
      lecturas: [{ id: 't1', internalCode: 'CG-002', turno: 'DIURNO', inicial: 100, final: 106, avance: 6 }],
    };
    // Payload cacheado por la PWA (sin los campos nuevos): sigue parseando.
    expect(ResumenDiaSchema.parse(viejo).cargas).toBeUndefined();

    const nuevo = ResumenDiaSchema.parse({
      ...viejo,
      reports: { totalHoras: 4, porEquipo: [{ equipmentId: 'e2', internalCode: 'EX-001', horas: 4 }] },
      lecturas: [
        {
          ...viejo.lecturas[0],
          operador: 'P. Rojas',
          registradoPor: 'Limbert V.',
          horaEntrada: '2026-11-13T08:00:00.000Z',
          horaSalida: null,
        },
      ],
      cargas: [
        {
          equipmentId: 'e1',
          internalCode: 'CG-002',
          litros: 40,
          tipo: 'PETROLEO',
          hora: '2026-11-13T12:00:00.000Z',
          operador: 'P. Rojas',
          cargadoPor: 'Limbert V.',
        },
        { equipmentId: 'e0', internalCode: 'AA-001', litros: 20, tipo: 'BENCINA', hora: '2026-11-13T13:00:00.000Z', operador: null, cargadoPor: null },
      ],
    });
    expect(nuevo.reports.porEquipo[0].equipmentId).toBe('e2');
    expect(nuevo.lecturas[0]).toMatchObject({ registradoPor: 'Limbert V.', horaEntrada: '2026-11-13T08:00:00.000Z', horaSalida: null });
    expect(nuevo.cargas).toHaveLength(2);
    expect(nuevo.cargas?.[1]).toMatchObject({ cargadoPor: null, operador: null, tipo: 'BENCINA' });
  });

  it('rechaza un estado fuera de vocabulario', () => {
    expect(() =>
      ResumenHoySchema.parse({
        totales: { enUso: 0, disponibles: 0, inoperativos: 0 },
        equipos: [{ equipmentId: 'e', internalCode: 'X', estado: 'APAGADO' }],
      }),
    ).toThrow();
  });
});
