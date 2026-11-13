import { describe, expect, it } from 'vitest';

import { validarLitros } from './litros';

describe('validarLitros', () => {
  it('lee el punto del surtidor como coma: 48.493 son 48,493 L', () => {
    expect(validarLitros('48.493', { liviano: true })).toEqual({ valor: 48.493, error: null, aviso: null });
    expect(validarLitros('48,493', { liviano: false }).valor).toBe(48.493);
  });

  it('en una camioneta, 48493 L no se guarda y sugiere 48,493', () => {
    const r = validarLitros('48493', { liviano: true });
    expect(r.error).toMatch(/no cabe en una camioneta/);
    expect(r.error).toMatch(/48,493 si es un surtidor digital/);
  });

  it('en un pesado, más de 1.000 L tampoco se guarda y sugiere la coma', () => {
    const r = validarLitros('48493', { liviano: false });
    expect(r.error).toMatch(/48,493 si es un surtidor digital/);
    expect(validarLitros('950', { liviano: false }).error).toBeNull();
    // Caso real de SEM 06: el contador de ruedas marcaba 0 1 3 4 8 y se escribió 1340.
    const sem06 = validarLitros('1340', { liviano: false }).error;
    expect(sem06).toMatch(/1,34 si es un surtidor digital/);
    expect(sem06).toMatch(/134 si es un contador de ruedas/);
  });

  it('una carga normal de pesado no avisa', () => {
    expect(validarLitros('350,5', { liviano: false })).toEqual({ valor: 350.5, error: null, aviso: null });
  });

  it('vacío no es error; texto o fuera de rango sí', () => {
    expect(validarLitros('', { liviano: true }).error).toBeNull();
    expect(validarLitros('abc', { liviano: true }).error).toMatch(/Escribe un número/);
    expect(validarLitros('200000', { liviano: false }).error).toMatch(/0 a 100.000/);
  });
});
