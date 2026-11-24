import { describe, expect, it } from 'vitest';

import { describeSort, type SortMeta } from './sort-description';

const OPCIONES: SortMeta[] = [
  { id: 'fecha', label: 'Fecha', reading: 'date' },
  { id: 'nombre', label: 'Nombre', reading: 'text' },
  { id: 'litros', label: 'Litros', reading: 'number' },
  { id: 'estado', label: 'Estado', reading: ['abierto primero', 'cerrado primero'] },
];

describe('describeSort', () => {
  it('lee fechas, texto y números según su tipo', () => {
    expect(describeSort({ column: 'fecha', direction: 'descending' }, OPCIONES)).toBe(
      'Ordenado por fecha, del más reciente al más antiguo.',
    );
    expect(describeSort({ column: 'nombre', direction: 'ascending' }, OPCIONES)).toBe(
      'Ordenado por nombre, de la A a la Z.',
    );
    expect(describeSort({ column: 'litros', direction: 'descending' }, OPCIONES)).toBe(
      'Ordenado por litros, de mayor a menor.',
    );
  });

  it('usa la lectura propia de una columna de niveles', () => {
    expect(describeSort({ column: 'estado', direction: 'ascending' }, OPCIONES)).toBe(
      'Ordenado por estado, abierto primero.',
    );
  });

  it('una columna desconocida no dice nada', () => {
    expect(describeSort({ column: 'otra', direction: 'ascending' }, OPCIONES)).toBe('');
  });
});
