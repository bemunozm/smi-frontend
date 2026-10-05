import { describe, expect, it } from 'vitest';

import { ENDPOINTS } from './index';
import { bodyText, entityOf, param, referencias } from './define';

describe('registro tipado por entrada', () => {
  it('un nombre de campo mal escrito no compila (antes devolvía undefined y se perdía la dependencia)', () => {
    const body = { id: 'h-1', equipoId: 'eq-1' };

    expect(bodyText(body, 'equipoId')).toBe('eq-1');
    // @ts-expect-error 'equipoID' no es un campo del body: es justo el typo que esto debe atrapar.
    bodyText(body, 'equipoID');
  });

  it('un parámetro de ruta mal escrito tampoco compila', () => {
    const params = { ordenId: 'ot-1' };

    expect(param(params, 'ordenId')).toBe('ot-1');
    expect(() =>
      // @ts-expect-error 'ordenID' no es un parámetro de esta ruta.
      param(params, 'ordenID'),
    ).toThrow();
  });

  it('bodyPreconditions solo admite campos del body', () => {
    expect(ENDPOINTS['item.adjust'].bodyPreconditions).toEqual(['expectedQuantity']);
  });

  it('param lanza un error de dominio si falta, y codifica el valor', () => {
    expect(() => param({ id: '' }, 'id')).toThrow(/Falta el parámetro id/);
    expect(param({ id: 'a b/c' }, 'id')).toBe('a%20b%2Fc');
  });

  it('referencias y entityOf omiten lo que falta', () => {
    expect(entityOf((id) => `x:${id}`, undefined)).toBeUndefined();
    expect(referencias('a', undefined, 'b')).toEqual(['a', 'b']);
  });
});
