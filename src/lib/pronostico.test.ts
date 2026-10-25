import { describe, expect, it } from 'vitest';

import { diaCorto, lineaPronostico, ritmo } from './pronostico';
import type { MaintenanceForecastRow } from '../types/maintenance-forecast';

const BASE: MaintenanceForecastRow = {
  equipmentId: 'eq_l',
  unit: 'km',
  source: 'LIVIANO',
  nextAt: 30000,
  remaining: 470,
  status: 'ESTIMADA',
  dailyUsage: 85,
  basedOnDays: 28,
  estimatedDate: '2026-10-30',
  weekStart: '2026-10-24',
  suggestedDate: null,
};

describe('pronóstico de mantención', () => {
  it('diaCorto: día de la semana y fecha', () => {
    expect(diaCorto('2026-10-30')).toBe('vie 30-10');
    expect(diaCorto('2026-11-01')).toBe('dom 01-11');
  });

  it('línea corta: fecha estimada y, si hay historial, el día sugerido', () => {
    expect(lineaPronostico(BASE)).toBe('≈ vie 30-10');
    expect(lineaPronostico({ ...BASE, suggestedDate: '2026-10-25' })).toBe('≈ vie 30-10 · mejor dom 25-10');
  });

  it('sin fecha, dice por qué', () => {
    expect(lineaPronostico({ ...BASE, status: 'FALTAN_DATOS', estimatedDate: null })).toBe(
      'Fecha: faltan registros de uso',
    );
    expect(lineaPronostico({ ...BASE, status: 'SIN_USO', estimatedDate: null })).toBe('Sin uso en 4 semanas');
    expect(lineaPronostico({ ...BASE, status: 'TOCA_AHORA' })).toBeNull();
  });

  it('ritmo en la unidad del equipo: horas máquina o km', () => {
    expect(ritmo(BASE)).toBe('a ~85 km/día (últimos 28 días)');
    expect(ritmo({ ...BASE, unit: 'h', dailyUsage: 18.5 })).toBe('a ~18,5 h/día (últimos 28 días)');
  });
});
