import { describe, expect, it } from 'vitest';

import { MetricasEquipoSchema, ResumenHoySchema } from './dashboard';

describe('dashboard schemas', () => {
  it('parsea el resumen de hoy', () => {
    const res = ResumenHoySchema.parse({
      totales: { enUso: 1, disponibles: 2, inoperativos: 0 },
      equipos: [
        { equipmentId: 'e1', internalCode: 'CG-002', estado: 'EN_USO', operador: 'P. Rojas', turno: 'DIURNO', supervisor: 'Limbert' },
        { equipmentId: 'e2', internalCode: 'EX-001', estado: 'DISPONIBLE' },
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

  it('rechaza un estado fuera de vocabulario', () => {
    expect(() =>
      ResumenHoySchema.parse({
        totales: { enUso: 0, disponibles: 0, inoperativos: 0 },
        equipos: [{ equipmentId: 'e', internalCode: 'X', estado: 'APAGADO' }],
      }),
    ).toThrow();
  });
});
