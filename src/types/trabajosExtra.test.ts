import { describe, it, expect } from 'vitest';
import { trabajoExtraFormSchema } from './trabajosExtra';

const base = {
  equipoId: 'e1',
  operatorId: 'op_1',
  faena: 'Patillo',
  turno: 'DIURNO',
  horometroInicial: 1200,
  horometroFinal: 1212,
  actividades: ['REGULACION_CARGA'],
  descripcion: 'Carga de material',
  reportNumero: '4509',
  destino: 'TRANSPORTE',
};

describe('trabajoExtraFormSchema', () => {
  it('acepta un trabajo válido', () => {
    expect(trabajoExtraFormSchema.safeParse(base).success).toBe(true);
  });

  it('rechaza horómetro final menor que inicial', () => {
    expect(trabajoExtraFormSchema.safeParse({ ...base, horometroFinal: 1100 }).success).toBe(false);
  });

  it('rechaza un trabajo sin operador elegido', () => {
    const r = trabajoExtraFormSchema.safeParse({ ...base, operatorId: '' });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.issues.some((i) => i.message === 'Elegí el operador')).toBe(true);
    }
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

  // --- Report: dónde se hizo (regla del cliente) ----------------------------

  it('rechaza un trabajo sin N° de report o sin destino', () => {
    expect(trabajoExtraFormSchema.safeParse({ ...base, reportNumero: '' }).success).toBe(false);
    expect(trabajoExtraFormSchema.safeParse({ ...base, destino: undefined }).success).toBe(false);
  });

  it('PLANTA solo con limpieza de silos, y siempre diciendo cuál', () => {
    // Sin limpieza de silos → no puede ser planta.
    expect(
      trabajoExtraFormSchema.safeParse({ ...base, destino: 'PLANTA', planta: 'Planta 1' }).success,
    ).toBe(false);
    // Con limpieza de silos pero sin decir cuál planta → tampoco.
    expect(
      trabajoExtraFormSchema.safeParse({ ...base, actividades: ['LIMPIEZA_SILOS'], destino: 'PLANTA' })
        .success,
    ).toBe(false);
    // Completo → válido.
    expect(
      trabajoExtraFormSchema.safeParse({
        ...base,
        actividades: ['LIMPIEZA_SILOS'],
        destino: 'PLANTA',
        planta: 'Planta 4',
      }).success,
    ).toBe(true);
  });

  it('las otras actividades aceptan Transporte o Variado', () => {
    expect(trabajoExtraFormSchema.safeParse({ ...base, destino: 'VARIADO' }).success).toBe(true);
  });
});
