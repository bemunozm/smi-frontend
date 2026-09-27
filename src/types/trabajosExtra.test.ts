import { describe, it, expect } from 'vitest';
import { trabajoExtraFormSchema } from './trabajosExtra';

const base = {
  equipoId: 'e1',
  operador: 'Juan Rojas',
  faena: 'Patillo',
  turno: 'DIURNO',
  horometroInicial: 1200,
  horometroFinal: 1212,
  actividades: ['REGULACION_CARGA'],
  descripcion: 'Carga de material',
};

describe('trabajoExtraFormSchema', () => {
  it('acepta un trabajo válido', () => {
    expect(trabajoExtraFormSchema.safeParse(base).success).toBe(true);
  });

  it('rechaza horómetro final menor que inicial', () => {
    expect(trabajoExtraFormSchema.safeParse({ ...base, horometroFinal: 1100 }).success).toBe(false);
  });

  it('rechaza una actividad que no está en la lista', () => {
    expect(trabajoExtraFormSchema.safeParse({ ...base, actividades: ['OTRA'] }).success).toBe(false);
  });

  /** Una salida suele mezclar tareas: el formulario acepta varias. */
  it('acepta varias actividades', () => {
    const r = trabajoExtraFormSchema.safeParse({
      ...base,
      actividades: ['SOLTAR_MATERIAL', 'LIMPIEZA_CANCHA'],
    });
    expect(r.success).toBe(true);
  });

  it('rechaza un trabajo sin ninguna actividad', () => {
    expect(trabajoExtraFormSchema.safeParse({ ...base, actividades: [] }).success).toBe(false);
  });

  /**
   * «Otro» sin texto deja la actividad registrada como «otro» a secas y el
   * trabajo no se podría justificar ni cobrar. El servidor aplica la misma
   * regla — acá se avisa antes de mandar.
   */
  it('rechaza «Otro» sin describir cuál fue', () => {
    expect(trabajoExtraFormSchema.safeParse({ ...base, actividades: ['OTRO'] }).success).toBe(false);
    expect(
      trabajoExtraFormSchema.safeParse({ ...base, actividades: ['OTRO'], otraActividad: '   ' })
        .success,
    ).toBe(false);
  });

  it('acepta «Otro» con su texto', () => {
    const r = trabajoExtraFormSchema.safeParse({
      ...base,
      actividades: ['HACER_PETRIL', 'OTRO'],
      otraActividad: 'Despeje de acceso a romana',
    });
    expect(r.success).toBe(true);
  });
});
