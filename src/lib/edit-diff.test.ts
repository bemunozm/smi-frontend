import { describe, expect, it } from 'vitest';

import { conPendientes, diferenciaEdicion, edicionContraBase, pickFields, precondicion } from './edit-diff';

describe('pickFields', () => {
  it('toma solo los campos pedidos de la entidad', () => {
    expect(pickFields({ id: 'e1', name: 'A', extra: 1 }, ['id', 'name'])).toEqual({ id: 'e1', name: 'A' });
  });
});

describe('edicionContraBase', () => {
  const base = { name: 'A', address: 'Calle 1' as string | null, isActive: true };
  const campos = ['name', 'address', 'isActive'] as const;

  it('un campo que el formulario no trae es "sin cambio"; null es "dejarlo vacío"', () => {
    const edicion = edicionContraBase(base, { name: 'B', address: null }, campos);

    expect(edicion.cambios).toEqual({ name: 'B', address: null });
    expect(edicion.esperado).toEqual({ name: 'A', address: 'Calle 1' });
    expect(edicion.hayCambios).toBe(true);
  });

  it('sin diferencias no hay cambios ni precondición', () => {
    const edicion = edicionContraBase(base, { name: 'A', isActive: undefined }, campos);

    expect(edicion.hayCambios).toBe(false);
    expect(edicion.cambios).toEqual({});
    expect(edicion.esperado).toBeUndefined();
  });

  it('un campo que la base no tenía y el formulario deja vacío no es un cambio', () => {
    expect(edicionContraBase({ ...base, address: null }, { address: null }, campos).hayCambios).toBe(false);
  });
});

describe('diferenciaEdicion', () => {
  const base = { a: 'x', b: 1, c: ['u', 'v'], d: undefined as string | undefined };

  it('devuelve solo lo cambiado y, aparte, el valor base de esos campos', () => {
    const diff = diferenciaEdicion(base, { ...base, a: 'y', c: ['u', 'w'] }, ['a', 'b', 'c', 'd']);

    expect(diff.cambios).toEqual({ a: 'y', c: ['u', 'w'] });
    expect(diff.esperado).toEqual({ a: 'x', c: ['u', 'v'] });
  });

  it('sin cambios, queda vacío; los arrays se comparan por contenido', () => {
    expect(diferenciaEdicion(base, { ...base, c: ['u', 'v'] }, ['a', 'b', 'c']).cambios).toEqual({});
  });

  it('solo mira los campos pedidos', () => {
    expect(diferenciaEdicion(base, { ...base, a: 'z' }, ['b']).cambios).toEqual({});
  });
});

describe('precondicion', () => {
  it('un campo vacío viaja como null, no desaparece', () => {
    expect(precondicion({ a: 'x', b: undefined })).toEqual({ a: 'x', b: null });
  });

  it('puede limitarse a ciertos campos', () => {
    expect(precondicion({ a: 'x', b: 2 }, ['b'])).toEqual({ b: 2 });
  });
});

describe('conPendientes', () => {
  const base = { nombre: 'A', estado: 'ABIERTA', fecha: null as string | null };
  const campos = ['nombre', 'estado', 'fecha'] as const;

  it('pone por encima de la base lo que ya espera en la cola', () => {
    expect(conPendientes(base, { nombre: 'B', fecha: '2026-10-05' }, campos)).toEqual({
      nombre: 'B',
      estado: 'ABIERTA',
      fecha: '2026-10-05',
    });
  });

  it('un campo pendiente en null cuenta (limpiar un valor es un cambio)', () => {
    expect(conPendientes({ ...base, fecha: '2026-01-01' }, { fecha: null }, campos).fecha).toBeNull();
  });

  it('ignora lo que no es un campo pedido y no toca el original', () => {
    const resultado = conPendientes(base, { otro: 1, nombre: 'C' }, ['nombre']);

    expect(resultado).toEqual({ nombre: 'C', estado: 'ABIERTA', fecha: null });
    expect(base.nombre).toBe('A');
  });

  it('dos ediciones seguidas del mismo campo no chocan entre sí: la segunda parte de la primera', () => {
    const primera = diferenciaEdicion(base, { ...base, nombre: 'B' }, campos);
    const baseDeLaSegunda = conPendientes(base, primera.cambios, campos);
    const segunda = diferenciaEdicion(baseDeLaSegunda, { ...base, nombre: 'C' }, campos);

    expect(segunda.esperado).toEqual({ nombre: 'B' });
  });
});
