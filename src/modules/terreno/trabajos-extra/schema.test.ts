import { describe, it, expect } from 'vitest';
import { trabajoExtraFormSchema } from './schema';

const base = {
  equipoId: 'e1',
  operador: 'Juan Rojas',
  faena: 'Rajo Norte',
  turno: 'DIURNO',
  horometroInicial: 1200,
  horometroFinal: 1212,
  actividad: 'REGULACION_CARGA',
  descripcion: 'Carga de material',
};

describe('trabajoExtraFormSchema', () => {
  it('acepta un trabajo válido', () => {
    expect(trabajoExtraFormSchema.safeParse(base).success).toBe(true);
  });

  it('rechaza horómetro final menor que inicial', () => {
    expect(trabajoExtraFormSchema.safeParse({ ...base, horometroFinal: 1100 }).success).toBe(false);
  });

  it('rechaza actividad inválida', () => {
    expect(trabajoExtraFormSchema.safeParse({ ...base, actividad: 'OTRA' }).success).toBe(false);
  });
});
