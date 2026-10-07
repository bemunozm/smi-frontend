import { describe, expect, it } from 'vitest';

import { PRIORIDADES_OT } from '../types/mantenimiento';
import { prioridadOTChipColor } from './mantenimiento-colors';

describe('prioridadOTChipColor', () => {
  it('cada nivel de prioridad tiene su PROPIO color (escala semáforo)', () => {
    expect(prioridadOTChipColor('BAJA')).toBe('success');
    expect(prioridadOTChipColor('MEDIA')).toBe('accent');
    expect(prioridadOTChipColor('ALTA')).toBe('warning');
    expect(prioridadOTChipColor('CRITICA')).toBe('danger');
  });

  it('ningún nivel comparte color con otro — la etiqueta se distingue sola', () => {
    const colores = PRIORIDADES_OT.map((prioridad) => prioridadOTChipColor(prioridad));
    expect(new Set(colores).size).toBe(PRIORIDADES_OT.length);
  });
});
