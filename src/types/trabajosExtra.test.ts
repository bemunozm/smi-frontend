import { describe, it, expect } from 'vitest';
import {
  tipoAlCambiarActividad,
  trabajoExtraCorreccionSchema,
  trabajoExtraEdicionSchema,
  trabajoExtraFormSchema,
} from './trabajosExtra';

const fila = (over: Record<string, unknown> = {}) => ({
  actividad: 'LIMPIEZA_CANCHA',
  lugar: 'TRANSPORTE',
  horas: 2,
  descripcion: 'Cancha norte, frente a la romana',
  ...over,
});

const base = {
  equipoId: 'e1',
  operatorId: 'op_1',
  faena: 'Patillo',
  turno: 'DIURNO',
  horometroInicial: 1200,
  horometroFinal: 1212,
  detalle: [fila()],
  descripcion: 'Carga de material',
  reportNumero: '4509',
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

  // --- El desglose: una fila por actividad, con lugar y horas --------------

  it('rechaza una actividad que no está en la lista', () => {
    expect(
      trabajoExtraFormSchema.safeParse({ ...base, detalle: [fila({ actividad: 'OTRA' })] }).success,
    ).toBe(false);
  });

  /** Una salida suele mezclar tareas: el desglose acepta varias filas. */
  it('acepta varias filas', () => {
    const r = trabajoExtraFormSchema.safeParse({
      ...base,
      detalle: [fila({ actividad: 'SOLTAR_MATERIAL', horas: 1.5 }), fila({ lugar: 'VARIADO', horas: 0.5 })],
    });
    expect(r.success).toBe(true);
  });

  it('rechaza un trabajo sin ninguna actividad', () => {
    expect(trabajoExtraFormSchema.safeParse({ ...base, detalle: [] }).success).toBe(false);
  });

  it('cada fila exige sus horas, mayores a 0 y de hasta 24', () => {
    expect(trabajoExtraFormSchema.safeParse({ ...base, detalle: [fila({ horas: undefined })] }).success).toBe(false);
    expect(trabajoExtraFormSchema.safeParse({ ...base, detalle: [fila({ horas: 0 })] }).success).toBe(false);
    expect(trabajoExtraFormSchema.safeParse({ ...base, detalle: [fila({ horas: 25 })] }).success).toBe(false);
  });

  it('cada fila exige dónde se hizo', () => {
    expect(trabajoExtraFormSchema.safeParse({ ...base, detalle: [fila({ lugar: '' })] }).success).toBe(false);
  });

  /**
   * «Otro» sin texto deja la actividad registrada como «otro» a secas y el
   * trabajo no se podría justificar ni cobrar. El servidor aplica la misma
   * regla — acá se avisa antes de mandar.
   */
  it('rechaza «Otro» sin describir cuál fue', () => {
    expect(
      trabajoExtraFormSchema.safeParse({ ...base, detalle: [fila({ actividad: 'OTRO' })] }).success,
    ).toBe(false);
    expect(
      trabajoExtraFormSchema.safeParse({
        ...base,
        detalle: [fila({ actividad: 'OTRO' })],
        otraActividad: '   ',
      }).success,
    ).toBe(false);
  });

  it('acepta «Otro» con su texto', () => {
    const r = trabajoExtraFormSchema.safeParse({
      ...base,
      detalle: [fila({ actividad: 'HACER_PETRIL' }), fila({ actividad: 'OTRO' })],
      otraActividad: 'Despeje de acceso a romana',
    });
    expect(r.success).toBe(true);
  });

  // --- Report: dónde se hizo cada fila (regla del cliente) ------------------

  it('rechaza un trabajo sin N° de report', () => {
    expect(trabajoExtraFormSchema.safeParse({ ...base, reportNumero: '' }).success).toBe(false);
  });

  it('PLANTA solo con limpieza de silos, y siempre diciendo cuál', () => {
    // Sin limpieza de silos → esa fila no puede ser planta.
    expect(
      trabajoExtraFormSchema.safeParse({
        ...base,
        detalle: [fila({ lugar: 'PLANTA', plantas: ['Planta 1'] })],
      }).success,
    ).toBe(false);
    // Con limpieza de silos pero sin decir cuál planta → tampoco.
    expect(
      trabajoExtraFormSchema.safeParse({
        ...base,
        detalle: [fila({ actividad: 'LIMPIEZA_SILOS', lugar: 'PLANTA' })],
      }).success,
    ).toBe(false);
    // Completo → válido, incluso junto a otra fila en transporte.
    expect(
      trabajoExtraFormSchema.safeParse({
        ...base,
        detalle: [
          fila({ actividad: 'LIMPIEZA_SILOS', lugar: 'PLANTA', plantas: ['Planta 4'] }),
          fila({ actividad: 'SOLTAR_MATERIAL' }),
        ],
      }).success,
    ).toBe(true);
    // Varias plantas (PP1 y PP4) → válido; la lista vacía → no.
    expect(
      trabajoExtraFormSchema.safeParse({
        ...base,
        detalle: [fila({ actividad: 'LIMPIEZA_SILOS', lugar: 'PLANTA', plantas: ['Planta 1', 'Planta 4'] })],
      }).success,
    ).toBe(true);
    expect(
      trabajoExtraFormSchema.safeParse({
        ...base,
        detalle: [fila({ actividad: 'LIMPIEZA_SILOS', lugar: 'PLANTA', plantas: [] })],
      }).success,
    ).toBe(false);
  });

  it('al registrar, cada actividad lleva su descripción', () => {
    const r = trabajoExtraFormSchema.safeParse({ ...base, detalle: [fila({ descripcion: ' ' })] });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.issues.some((i) => i.path.join('.') === 'detalle.0.descripcion')).toBe(true);
    }
    expect(trabajoExtraFormSchema.safeParse({ ...base, detalle: [fila({ descripcion: undefined })] }).success).toBe(
      false,
    );
  });

  it('al corregir, una actividad anterior a la descripción puede quedar sin ella', () => {
    expect(
      trabajoExtraCorreccionSchema.safeParse({ ...base, detalle: [fila({ descripcion: undefined })] }).success,
    ).toBe(true);
  });

  it('la limpieza de silos pasa sola a tipo Planta; salir de ella deja el tipo por elegir', () => {
    expect(tipoAlCambiarActividad('LIMPIEZA_SILOS', 'TRANSPORTE')).toBe('PLANTA');
    expect(tipoAlCambiarActividad('LIMPIEZA_CANCHA', 'PLANTA')).toBe('');
    expect(tipoAlCambiarActividad('LIMPIEZA_CANCHA', 'VARIADO')).toBe('VARIADO');
  });

  it('las otras actividades aceptan Transporte o Variado', () => {
    expect(
      trabajoExtraFormSchema.safeParse({ ...base, detalle: [fila({ lugar: 'VARIADO' })] }).success,
    ).toBe(true);
  });
});

describe('trabajoExtraEdicionSchema (trabajos legacy)', () => {
  it('acepta una edición sin folio ni desglose: el diff no los toca', () => {
    const { reportNumero: _folio, detalle: _detalle, ...sinReport } = base;
    expect(trabajoExtraEdicionSchema.safeParse(sinReport).success).toBe(true);
  });

  it('cuando el desglose sí viene, aplica las mismas reglas', () => {
    expect(
      trabajoExtraEdicionSchema.safeParse({
        ...base,
        detalle: [fila({ lugar: 'PLANTA', plantas: ['Planta 1'] })],
      }).success,
    ).toBe(false);
  });
});

describe('números escritos en los campos de texto', () => {
  it('lee horómetros y horas con coma o punto decimal', () => {
    const r = trabajoExtraFormSchema.safeParse({
      ...base,
      horometroInicial: '1200,5',
      horometroFinal: '1212.5',
      detalle: [fila({ horas: '1,5' })],
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.horometroInicial).toBe(1200.5);
      expect(r.data.horometroFinal).toBe(1212.5);
      expect(r.data.detalle[0]?.horas).toBe(1.5);
    }
  });

  it('avisa cómo escribir las horas si no son número', () => {
    const r = trabajoExtraFormSchema.safeParse({ ...base, detalle: [fila({ horas: 'dos' })] });
    expect(r.success).toBe(false);
    expect(r.error?.issues[0]?.message).toMatch(/coma o punto/);
  });
});
