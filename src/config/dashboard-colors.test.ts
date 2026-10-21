import { describe, expect, it } from 'vitest';

import { nivelRespectoPromedio } from './dashboard-colors';

describe('nivelRespectoPromedio', () => {
  it('clasifica contra ±10% del promedio', () => {
    expect(nivelRespectoPromedio(111, 100)).toBe('alto');
    expect(nivelRespectoPromedio(110, 100)).toBe('alto'); // borde: >= 110%
    expect(nivelRespectoPromedio(109, 100)).toBe('medio');
    expect(nivelRespectoPromedio(100, 100)).toBe('medio');
    expect(nivelRespectoPromedio(91, 100)).toBe('medio');
    expect(nivelRespectoPromedio(90, 100)).toBe('bajo'); // borde: <= 90%
    expect(nivelRespectoPromedio(0, 100)).toBe('bajo');
  });

  it('con promedio 0 (gráfico todo en cero) no hay comparación: todo es medio', () => {
    expect(nivelRespectoPromedio(0, 0)).toBe('medio');
    expect(nivelRespectoPromedio(5, 0)).toBe('medio');
  });
});
