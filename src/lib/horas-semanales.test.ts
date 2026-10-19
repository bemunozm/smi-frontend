import { describe, it, expect } from 'vitest';
import type { MetricasEquipo } from '../types/dashboard';
import { horasSemanales, inicioSemana } from './horas-semanales';

const eq = (code: string, dias: [string, number][]): MetricasEquipo => ({
  equipmentId: code,
  internalCode: code,
  horas: dias.reduce((a, [, h]) => a + h, 0),
  litros: 0,
  rendimiento: null,
  serieDiaria: dias.map(([fecha, horas]) => ({ fecha, horas, opero: horas > 0 })),
});

describe('horasSemanales', () => {
  it('inicio de semana es lunes: el domingo pertenece a la semana anterior', () => {
    expect(inicioSemana('2026-10-12')).toBe('2026-10-12'); // lunes
    expect(inicioSemana('2026-10-18')).toBe('2026-10-12'); // domingo
    expect(inicioSemana('2026-10-19')).toBe('2026-10-19'); // lunes siguiente
  });

  it('agrupa a través del límite de mes y suma por semana', () => {
    // lunes 2026-09-28 .. domingo 2026-10-04 es una sola semana
    const { filas } = horasSemanales([eq('A', [['2026-09-30', 3], ['2026-10-02', 4], ['2026-10-05', 5]])]);
    expect(filas).toHaveLength(2);
    expect(filas[0]).toMatchObject({ semana: '28/09', semanaInicio: '2026-09-28', A: 7 });
    expect(filas[1]).toMatchObject({ semana: '05/10', A: 5 });
  });

  it('excluye equipos con 0 horas en todo el rango', () => {
    const { filas, codigos } = horasSemanales([
      eq('A', [['2026-10-13', 2]]),
      eq('Z', [['2026-10-13', 0]]),
    ]);
    expect(codigos).toEqual(['A']);
    expect(filas[0]).not.toHaveProperty('Z');
  });

  it('ordena cronológicamente y rellena con 0 las semanas sin datos', () => {
    const { filas } = horasSemanales([
      eq('A', [['2026-10-14', 1], ['2026-09-30', 2]]),
      eq('B', [['2026-10-14', 6]]),
    ]);
    expect(filas.map((f) => f.semanaInicio)).toEqual(['2026-09-28', '2026-10-05', '2026-10-12']);
    expect(filas[1]).toMatchObject({ A: 0, B: 0 });
    expect(filas[0]).toMatchObject({ A: 2, B: 0 });
  });

  it('sin datos devuelve vacío', () => {
    expect(horasSemanales([])).toEqual({ filas: [], codigos: [] });
  });
});
