import { describe, expect, it } from 'vitest';

import { diferenciaEdicion, precondicion } from './edit-diff';

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
