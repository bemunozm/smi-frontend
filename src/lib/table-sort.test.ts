import { describe, it, expect } from 'vitest';

import { compareDate, compareNumber, compareText, nextSort, sortRows, type SortColumn } from './table-sort';

interface Fila {
  id: string;
  dia: string | null;
  turno: 'DIURNO' | 'NOCTURNO';
  nombre: string | null;
  n: number | null;
}

const rank = (t: Fila['turno']) => (t === 'DIURNO' ? 0 : 1);
const COLUMNAS: Record<string, SortColumn<Fila>> = {
  dia: {
    kind: 'date',
    value: (f) => f.dia,
    tiebreak: (a, b) => rank(a.turno) - rank(b.turno),
  },
  nombre: { kind: 'text', value: (f) => f.nombre },
  n: { kind: 'number', value: (f) => f.n },
};

const fila = (id: string, dia: string | null, turno: Fila['turno'] = 'DIURNO', extra: Partial<Fila> = {}): Fila => ({
  id,
  dia,
  turno,
  nombre: null,
  n: null,
  ...extra,
});

const ids = (rows: Fila[]) => rows.map((r) => r.id);

describe('comparadores', () => {
  it('texto es-CL: ignora tildes/mayúsculas y ordena números como números', () => {
    expect(compareText('Álvaro', 'alvaro')).toBe(0);
    expect(compareText('Ñandú', 'Zorro')).toBeLessThan(0);
    expect(compareText('2', '10')).toBeLessThan(0);
  });

  it('número y fecha', () => {
    expect(compareNumber(2, 10)).toBeLessThan(0);
    expect(compareDate('2026-11-01', '2026-11-20')).toBeLessThan(0);
  });
});

describe('sortRows', () => {
  const cargados = [
    fila('20-nov', '2026-11-20'),
    fila('1-nov', '2026-11-01'),
    fila('10-nov', '2026-11-10'),
    fila('5-nov', '2026-11-05'),
  ];

  it('turnos cargados fuera de orden: ascendente va del 1 al 20 de noviembre', () => {
    const asc = sortRows(cargados, { column: 'dia', direction: 'ascending' }, COLUMNAS);
    expect(ids(asc)).toEqual(['1-nov', '5-nov', '10-nov', '20-nov']);
    const desc = sortRows(cargados, { column: 'dia', direction: 'descending' }, COLUMNAS);
    expect(ids(desc)).toEqual(['20-nov', '10-nov', '5-nov', '1-nov']);
  });

  it('no muta el arreglo original', () => {
    const copia = [...cargados];
    sortRows(cargados, { column: 'dia', direction: 'ascending' }, COLUMNAS);
    expect(cargados).toEqual(copia);
  });

  it('mismo día: Diurno antes que Nocturno en ascendente (y al revés en descendente)', () => {
    const rows = [fila('noche', '2026-11-05', 'NOCTURNO'), fila('dia', '2026-11-05', 'DIURNO')];
    expect(ids(sortRows(rows, { column: 'dia', direction: 'ascending' }, COLUMNAS))).toEqual(['dia', 'noche']);
    expect(ids(sortRows(rows, { column: 'dia', direction: 'descending' }, COLUMNAS))).toEqual(['noche', 'dia']);
  });

  it('los vacíos van al final en ascendente y en descendente', () => {
    const rows = [
      fila('vacio', '2026-11-01', 'DIURNO', { n: null }),
      fila('dos', '2026-11-01', 'DIURNO', { n: 2 }),
      fila('diez', '2026-11-01', 'DIURNO', { n: 10 }),
    ];
    expect(ids(sortRows(rows, { column: 'n', direction: 'ascending' }, COLUMNAS))).toEqual(['dos', 'diez', 'vacio']);
    expect(ids(sortRows(rows, { column: 'n', direction: 'descending' }, COLUMNAS))).toEqual(['diez', 'dos', 'vacio']);
  });

  it('texto vacío o en blanco cuenta como vacío', () => {
    const rows = [
      fila('v', null, 'DIURNO', { nombre: '  ' }),
      fila('b', null, 'DIURNO', { nombre: 'Berta' }),
      fila('a', null, 'DIURNO', { nombre: 'ana' }),
    ];
    expect(ids(sortRows(rows, { column: 'nombre', direction: 'ascending' }, COLUMNAS))).toEqual(['a', 'b', 'v']);
  });

  it('una columna desconocida deja el orden tal cual', () => {
    expect(ids(sortRows(cargados, { column: 'nada', direction: 'ascending' }, COLUMNAS))).toEqual(ids(cargados));
  });
});

describe('nextSort', () => {
  it('misma columna alterna el sentido; otra columna parte ascendente', () => {
    expect(nextSort({ column: 'dia', direction: 'descending' }, 'dia')).toEqual({ column: 'dia', direction: 'ascending' });
    expect(nextSort({ column: 'dia', direction: 'ascending' }, 'dia')).toEqual({ column: 'dia', direction: 'descending' });
    expect(nextSort({ column: 'dia', direction: 'descending' }, 'n')).toEqual({ column: 'n', direction: 'ascending' });
  });
});
