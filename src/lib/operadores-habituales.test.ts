import { describe, expect, it } from 'vitest';

import { opcionesOperador } from './operadores-habituales';

const OPERADORES = [
  { id: 'a', name: 'Arturo Cortes', supervisorHabitualId: 'sup_johan' },
  { id: 'm', name: 'Milton Mosquera', supervisorHabitualId: 'sup_limbert' },
  { id: 'r', name: 'Roberto Perez', supervisorHabitualId: 'sup_limbert' },
  { id: 'j', name: 'Jose Farias', supervisorHabitualId: null },
];

describe('opcionesOperador', () => {
  it('«Tus operadores» primero y después los demás, en orden', () => {
    expect(opcionesOperador(OPERADORES, 'sup_limbert')).toEqual([
      { valor: 'm', titulo: 'Milton Mosquera', grupo: 'Tus operadores' },
      { valor: 'r', titulo: 'Roberto Perez', grupo: 'Tus operadores' },
      { valor: 'a', titulo: 'Arturo Cortes', grupo: 'Otros operadores' },
      { valor: 'j', titulo: 'Jose Farias', grupo: 'Otros operadores' },
    ]);
  });

  it('sin operadores habituales (o sin supervisor) la lista va de corrido, como antes', () => {
    const plana = OPERADORES.map((o) => ({ valor: o.id, titulo: o.name }));
    expect(opcionesOperador(OPERADORES, 'sup_nuevo')).toEqual(plana);
    expect(opcionesOperador(OPERADORES, undefined)).toEqual(plana);
  });
});
