import { describe, expect, it } from 'vitest';

import { filaPizarra } from './fixtures';
import { ordenarFilas, separarSinPauta, textoPendientes, tono } from './pizarra';

const codigos = (filas: { internalCode: string }[]) => filas.map((f) => f.internalCode);

describe('ordenarFilas', () => {
  it('los atrasados primero y después por pendientes ascendente', () => {
    const filas = [
      filaPizarra({ internalCode: 'A', remaining: 200 }),
      filaPizarra({ internalCode: 'B', remaining: -38 }),
      filaPizarra({ internalCode: 'C', remaining: 10 }),
    ];
    expect(codigos(ordenarFilas(filas))).toEqual(['B', 'C', 'A']);
  });

  it('con los mismos pendientes, la fila estimada va después de la que tiene último cambio', () => {
    const filas = [
      filaPizarra({ internalCode: 'EST', remaining: 50, estimated: true, lastChange: null }),
      filaPizarra({ internalCode: 'ANC', remaining: 50 }),
    ];
    expect(codigos(ordenarFilas(filas))).toEqual(['ANC', 'EST']);
  });

  it('sin pauta al final y los fuera de servicio después de todo, aunque estén atrasados', () => {
    const filas = [
      filaPizarra({ internalCode: 'FUERA', status: 'OUT_OF_SERVICE', remaining: -500 }),
      filaPizarra({ internalCode: 'SIN', source: 'SIN_PAUTA', remaining: null, dueAt: null, interval: null }),
      filaPizarra({ internalCode: 'OK', remaining: 300 }),
      filaPizarra({ internalCode: 'SINLECT', counter: null, remaining: null }),
    ];
    expect(codigos(ordenarFilas(filas))).toEqual(['OK', 'SINLECT', 'SIN', 'FUERA']);
  });

  it('no muta el arreglo que recibe', () => {
    const filas = [filaPizarra({ internalCode: 'A', remaining: 5 }), filaPizarra({ internalCode: 'B', remaining: 1 })];
    ordenarFilas(filas);
    expect(codigos(filas)).toEqual(['A', 'B']);
  });
});

describe('tono', () => {
  it('pendientes negativos = atrasado', () => {
    expect(tono(filaPizarra({ remaining: -1 }))).toBe('atrasado');
  });

  it('justo en el margen de aviso ya es alerta; uno más es normal', () => {
    expect(tono(filaPizarra({ remaining: 50, alertBefore: 50 }))).toBe('alerta');
    expect(tono(filaPizarra({ remaining: 51, alertBefore: 50 }))).toBe('normal');
  });

  it('sin pendientes (sin pauta o sin lectura) es normal', () => {
    expect(tono(filaPizarra({ remaining: null }))).toBe('normal');
  });

  it('sin margen de aviso configurado, solo lo que toca ahora es alerta', () => {
    expect(tono(filaPizarra({ remaining: 0, alertBefore: null }))).toBe('alerta');
    expect(tono(filaPizarra({ remaining: 5, alertBefore: null }))).toBe('normal');
  });
});

describe('separarSinPauta', () => {
  it('los sin pauta van aparte y las dos listas salen ordenadas', () => {
    const filas = [
      filaPizarra({ internalCode: 'SIN-B', source: 'SIN_PAUTA', remaining: null, dueAt: null, interval: null }),
      filaPizarra({ internalCode: 'OK', remaining: 300 }),
      filaPizarra({ internalCode: 'SIN-A', source: 'SIN_PAUTA', remaining: null, dueAt: null, interval: null }),
      filaPizarra({ internalCode: 'ATR', remaining: -10 }),
      filaPizarra({ internalCode: 'LIV', source: 'LIVIANO', unit: 'km', remaining: 5000 }),
    ];
    const { conPauta, sinPauta } = separarSinPauta(filas);
    expect(codigos(conPauta)).toEqual(['ATR', 'OK', 'LIV']);
    expect(codigos(sinPauta)).toEqual(['SIN-A', 'SIN-B']);
  });
});

describe('textoPendientes', () => {
  it('atrasado es solo el número con «+» (el estado lo dice la burbuja); sin lectura es null', () => {
    expect(textoPendientes(filaPizarra({ remaining: -216 }))).toBe('+216 h');
    expect(textoPendientes(filaPizarra({ remaining: 87 }))).toBe('87 h');
    expect(textoPendientes(filaPizarra({ remaining: null }))).toBeNull();
  });
});
